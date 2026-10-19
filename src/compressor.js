import { t } from './locale.js';
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function compressPdf(file, { mode = 'recommended', onProgress = () => {}, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (!file?.size || file.size > MAX_FILE_SIZE) throw new Error(t('Choose a PDF smaller than 100 MB.'));
  const header = new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer());
  if (!header.includes('%PDF-')) throw new Error(t('This file does not appear to be a PDF. Please choose a valid PDF.'));
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const buffer = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./compression.worker.js', import.meta.url), { type: 'module' });
    let timer;
    const cleanup = () => { clearTimeout(timer); worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error(t('This PDF is taking too long to process. Try a smaller file or use lossless mode.'))); }, 180000);
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress({ ...data.progress, message: t(data.progress.message) });
      else if (data.type === 'error') { cleanup(); reject(new Error(t(data.message))); }
      else if (data.type === 'result') { cleanup(); resolve(data.result); }
    };
    worker.onerror = () => { cleanup(); reject(new Error(t('The browser could not process this PDF. Try a smaller file or a current desktop browser.'))); };
    worker.postMessage({ buffer, mode }, [buffer]);
  });
}
