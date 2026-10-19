import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFDict } from 'pdf-lib';

const name = (value) => PDFName.of(value);
const progress = (percent, message) => self.postMessage({ type: 'progress', progress: { percent, message } });

// Only simple 8-bit RGB images are re-encoded. Masks, custom color spaces,
// predictors and decode arrays are deliberately preserved, never flattened.
async function optimizeImage(stream, context, mode) {
  const dict = stream.dict;
  const get = (key) => context.lookup(dict.get(name(key)));
  const width = get('Width')?.asNumber?.();
  const height = get('Height')?.asNumber?.();
  if (get('Subtype')?.toString() !== '/Image' || get('ColorSpace')?.toString() !== '/DeviceRGB' || get('BitsPerComponent')?.asNumber?.() !== 8) return false;
  if (!width || !height || width * height > 24000000 || width < 64 || height < 64) return false;
  if (['SMask', 'Mask', 'Decode', 'DecodeParms', 'SMaskInData', 'Alternates', 'OC'].some((key) => dict.has(name(key)))) return false;
  const filter = get('Filter')?.toString();
  const original = stream.getContents();
  let bitmap;
  try {
    if (filter === '/DCTDecode') {
      bitmap = await createImageBitmap(new Blob([original], { type: 'image/jpeg' }), { colorSpaceConversion: 'none' });
    } else if (mode === 'stronger' && (!filter || filter === '/FlateDecode')) {
      // RGB rasters may be charts or screenshots: preserve them in recommended mode.
      const rgb = filter ? new Uint8Array(await new Response(new Blob([original]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()) : original;
      if (rgb.length !== width * height * 3) return false;
      const rgba = new Uint8ClampedArray(width * height * 4);
      for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) { rgba[j] = rgb[i]; rgba[j + 1] = rgb[i + 1]; rgba[j + 2] = rgb[i + 2]; rgba[j + 3] = 255; }
      bitmap = await createImageBitmap(new ImageData(rgba, width, height));
    } else return false;
    if (bitmap.width !== width || bitmap.height !== height) return false;
    const scale = mode === 'stronger' ? Math.min(1, 2000 / Math.max(width, height)) : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: mode === 'stronger' ? 0.72 : 0.88 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length >= original.length * 0.97) return false;
    stream.contents = bytes;
    dict.set(name('Filter'), name('DCTDecode'));
    dict.set(name('Width'), PDFNumber.of(targetWidth));
    dict.set(name('Height'), PDFNumber.of(targetHeight));
    dict.set(name('Length'), PDFNumber.of(bytes.length));
    dict.delete(name('DL'));
    return true;
  } catch {
    // Unsupported individual images are left intact rather than failing the file.
    return false;
  } finally { bitmap?.close(); }
}

self.onmessage = async ({ data: { buffer, mode } }) => {
  try {
    if (!['lossless', 'recommended', 'stronger'].includes(mode)) throw new Error('Choose a valid compression setting.');
    progress(5, 'Reading your PDF locally…');
    const original = new Uint8Array(buffer);
    let doc;
    try {
      doc = await PDFDocument.load(original, { updateMetadata: false, throwOnInvalidObject: true });
      if (!doc.catalog || !doc.getPageCount()) throw new Error('Invalid PDF page tree');
    }
    catch (error) {
      if (/encrypt|password/i.test(error.message)) throw new Error('Password-protected PDFs are not supported. Unlock a copy first, then try again.');
      throw new Error('This PDF could not be read. It may be damaged or use an unsupported format.');
    }
    const objects = doc.context.enumerateIndirectObjects();
    for (const [, object] of objects) {
      if (object instanceof PDFDict && (object.get(name('FT'))?.toString() === '/Sig' || object.get(name('Type'))?.toString() === '/Sig')) throw new Error('This PDF contains a digital signature. Compression would invalidate it, so the original has been left untouched.');
    }
    const form = doc.catalog.lookup(name('AcroForm'));
    if (form instanceof PDFDict && form.has(name('XFA'))) throw new Error('This PDF contains an XFA form. To protect its behavior, this format is not supported.');
    let optimizedImages = 0;
    const imageCapable = typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';
    if (mode !== 'lossless' && !imageCapable) throw new Error('Image compression is not supported in this browser. Choose lossless mode or use a current browser.');
    const images = objects.map(([, object]) => object).filter((object) => object instanceof PDFRawStream && object.dict.get(name('Subtype'))?.toString() === '/Image');
    for (let i = 0; i < images.length && mode !== 'lossless'; i++) {
      progress(10 + Math.round((i / Math.max(1, images.length)) * 72), `Optimizing image ${i + 1} of ${images.length}…`);
      if (await optimizeImage(images[i], doc.context, mode)) optimizedImages++;
    }
    progress(88, 'Rebuilding the PDF structure…');
    const candidate = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false, objectsPerTick: 40 });
    progress(96, 'Checking the result…');
    const checked = await PDFDocument.load(candidate, { updateMetadata: false });
    if (checked.getPageCount() !== doc.getPageCount()) throw new Error('The output could not be validated. Your original file is unchanged.');
    const unchanged = candidate.length >= original.length;
    const bytes = unchanged ? original : candidate;
    const result = { bytes, originalSize: original.length, outputSize: bytes.length, optimizedImages: unchanged ? 0 : optimizedImages, pageCount: doc.getPageCount(), unchanged };
    progress(100, 'Ready to download');
    self.postMessage({ type: 'result', result }, [bytes.buffer]);
  } catch (error) { self.postMessage({ type: 'error', message: error.message || 'This PDF could not be compressed. Try another file.' }); }
};
