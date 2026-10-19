import './style.css';
import { compressPdf } from './compressor.js';
import { initAuth } from './auth.js';
import { t, isFrench, formatSize, savingsText, processedText } from './locale.js';

initAuth();

const $ = (id) => document.getElementById(id);
const input = $('file-input');
const dropZone = $('drop-zone');
const compressButton = $('compress-button');
const modeOptions = $('mode-options');
let selectedFile = null;
let controller = null;
let outputUrl = null;
let busy = false;
let selectionVersion = 0;

const size = formatSize;
const clearOutput = () => { if (outputUrl) URL.revokeObjectURL(outputUrl); outputUrl = null; $('result-panel').hidden = true; $('download-button').removeAttribute('href'); };
const showError = (message) => { $('error-message').textContent = t(message); $('error-message').hidden = false; };
const clearError = () => { $('error-message').hidden = true; $('error-message').textContent = ''; };
const setBusy = (value) => { busy = value; modeOptions.disabled = value; compressButton.disabled = value || !selectedFile; $('remove-file').disabled = value; dropZone.setAttribute('aria-disabled', String(value)); $('progress-panel').hidden = !value; compressButton.hidden = value; };

async function selectFile(file) {
  if (busy || !file) return;
  const version = ++selectionVersion;
  clearError(); clearOutput();
  selectedFile = null; compressButton.disabled = true;
  $('selected-file').hidden = true; dropZone.hidden = false;
  if (file.size > 100 * 1024 * 1024) { showError('Please choose a PDF smaller than 100 MB. Large files may also exceed your device’s memory.'); return; }
  if (!file.size) { showError('This file is empty. Please choose another PDF.'); return; }
  try {
    const head = new TextDecoder('latin1').decode(await file.slice(0, 1024).arrayBuffer());
    if (version !== selectionVersion) return;
    if (!head.includes('%PDF-')) { showError('This does not appear to be a PDF. Please choose a valid PDF file.'); return; }
    selectedFile = file;
    $('file-name').textContent = file.name;
    $('file-size').textContent = size(file.size);
    $('selected-file').hidden = false; dropZone.hidden = true;
    compressButton.disabled = false;
  } catch { if (version === selectionVersion) showError('We could not read this file. Please choose it again.'); }
}

dropZone.addEventListener('click', () => { if (!busy) input.click(); });
dropZone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!busy) input.click(); } });
input.addEventListener('change', () => { selectFile(input.files?.[0]); input.value = ''; });
for (const type of ['dragenter', 'dragover']) dropZone.addEventListener(type, (event) => { event.preventDefault(); if (!busy) dropZone.classList.add('is-dragging'); });
for (const type of ['dragleave', 'drop']) dropZone.addEventListener(type, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); });
dropZone.addEventListener('drop', (event) => {
  if (event.dataTransfer.files.length > 1) { showError('Please select one PDF at a time.'); return; }
  selectFile(event.dataTransfer.files[0]);
});
// Prevent an accidental browser navigation when a PDF is dropped outside the target.
document.addEventListener('dragover', (event) => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
document.addEventListener('drop', (event) => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });

function reset() {
  if (busy) return;
  selectionVersion++; selectedFile = null; input.value = ''; clearOutput(); clearError();
  $('selected-file').hidden = true; dropZone.hidden = false; compressButton.hidden = false; compressButton.disabled = true;
}
$('remove-file').addEventListener('click', reset);
$('start-over').addEventListener('click', () => { reset(); dropZone.focus(); });
modeOptions.addEventListener('change', () => {
  clearOutput();
  compressButton.hidden = false;
  compressButton.disabled = busy || !selectedFile;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  $('quality-note').textContent = t(({ lossless: 'Optimizes PDF structure without deliberately changing image pixels. Already optimized files may not shrink.', recommended: 'Keeps image dimensions and optimizes supported photos. Some image detail may change. Text and vector graphics stay sharp.', stronger: 'Recompresses supported images and may resize large photos to 2,000 pixels on their longest edge. Fine image detail can change.' })[mode]);
});
$('cancel-button').addEventListener('click', () => { controller?.abort(); $('progress-message').textContent = t('Cancelling…'); $('cancel-button').disabled = true; });

compressButton.addEventListener('click', async () => {
  if (!selectedFile || busy) return;
  const file = selectedFile;
  clearError(); clearOutput(); setBusy(true);
  controller = new AbortController();
  $('compression-progress').value = 0;
  $('progress-message').textContent = t('Preparing your PDF…');
  $('cancel-button').disabled = false;
  try {
    const result = await compressPdf(file, { mode: document.querySelector('input[name="mode"]:checked').value, signal: controller.signal, onProgress: ({ percent, message }) => { $('compression-progress').value = Math.max(0, Math.min(100, percent)); $('progress-message').textContent = message; } });
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const smaller = result.outputSize < result.originalSize && !result.unchanged;
    const blob = smaller ? new Blob([result.bytes], { type: 'application/pdf' }) : file;
    outputUrl = URL.createObjectURL(blob);
    const link = $('download-button'); link.href = outputUrl;
    link.download = smaller ? `${file.name.replace(/\.pdf$/i, '')}-${isFrench ? 'compresse' : 'compressed'}.pdf` : file.name;
    $('original-size').textContent = size(file.size); $('output-size').textContent = size(blob.size);
    $('savings').textContent = smaller ? savingsText(file.size, blob.size) : t('Original kept');
    $('result-title').textContent = t(smaller ? 'Ready for a lighter download.' : 'Your PDF is already doing well.');
    $('result-description').textContent = smaller ? processedText(result.pageCount) : t('This setting did not make your PDF smaller. Download your original, or try another compression level.');
    $('result-panel').hidden = false; compressButton.hidden = true;
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) { $('progress-message').textContent = t('Compression cancelled.'); showError('Compression cancelled. Your original file is unchanged.'); }
    else showError(error.message || 'We could not compress this PDF. Try a different file or a desktop browser.');
  } finally {
    const hasResult = !$('result-panel').hidden;
    setBusy(false); compressButton.hidden = hasResult; controller = null;
  }
});
window.addEventListener('pagehide', (event) => { controller?.abort(); if (!event.persisted && outputUrl) URL.revokeObjectURL(outputUrl); });
