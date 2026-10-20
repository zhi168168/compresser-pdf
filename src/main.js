import './style.css';
import { compressPdf } from './compressor.js';
import { initAuth } from './auth.js';
import { t, isFrench, formatSize, savingsText, processedText } from './locale.js';
import { resumeID, newResumeID, saveWorkspace, loadWorkspace, deleteWorkspace } from './workspace-store.js';

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
let completedResult = null;
let workspaceID = resumeID();
let storageTask = Promise.resolve();
let restoring = true;
let downloadBusy = false;
const storageError = 'We could not preserve your PDF for the sign-in redirect. Your result is still here. Use email sign-in or allow browser storage and try again.';

function trackButtonClick(eventName) {
  // Analytics must never interrupt file selection, compression or download.
  // Send no document names, contents or account identifiers.
  try {
    window.gtag?.('event', eventName, { language: isFrench ? 'fr' : 'en' });
  } catch { /* The tool remains usable when analytics is unavailable. */ }
}

function forgetWorkspace() {
  const oldID = workspaceID; workspaceID = null;
  if (oldID) storageTask = storageTask.catch(() => {}).then(() => deleteWorkspace(oldID)).catch(() => {});
  const url = new URL(location.href);
  if (url.searchParams.has('workspace')) {
    url.searchParams.delete('workspace'); history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
}

async function preserveWorkspace() {
  await workspaceReady;
  const url = new URL(location.pathname, location.origin);
  if (!selectedFile) return url.href;
  const id = workspaceID ||= newResumeID();
  const snapshot = { original: selectedFile, name: selectedFile.name, lastModified: selectedFile.lastModified,
    mode: document.querySelector('input[name="mode"]:checked').value, result: completedResult };
  storageTask = storageTask.catch(() => {}).then(() => saveWorkspace(id, snapshot));
  try { await storageTask; } catch { throw new Error(storageError); }
  url.searchParams.set('workspace', id);
  return url.href;
}

function updateDownloadButton() {
  const label = auth.isSignedIn() ? 'Download PDF' : 'Sign in to download';
  $('download-label').textContent = t(label);
  $('download-note').textContent = t(auth.isSignedIn()
    ? 'Your PDF is ready. Your file and comparison are preserved.'
    : 'Compression is complete. Sign in to download; your file and comparison will stay here.');
}

function renderResult() {
  if (!completedResult || !selectedFile) return;
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = URL.createObjectURL(completedResult.blob);
  const { blob, smaller, pageCount } = completedResult;
  $('original-size').textContent = size(selectedFile.size); $('output-size').textContent = size(blob.size);
  $('savings').textContent = smaller ? savingsText(selectedFile.size, blob.size) : t('Original kept');
  $('output-bar').style.width = `${Math.max(2, Math.min(100, blob.size / selectedFile.size * 100))}%`;
  $('result-title').textContent = t(smaller ? 'Ready for a lighter download.' : 'Your PDF is already doing well.');
  $('result-description').textContent = smaller ? processedText(pageCount) : t('This setting did not make your PDF smaller. Download your original, or try another compression level.');
  $('result-panel').hidden = false; compressButton.hidden = true;
  updateDownloadButton();
}

async function restoreWorkspace() {
  try {
    if (!workspaceID) return;
    const record = await loadWorkspace(workspaceID);
    if (!record) { forgetWorkspace(); return; }
    selectedFile = new File([record.original], record.name, { type: 'application/pdf', lastModified: record.lastModified });
    completedResult = record.result;
    document.querySelector(`input[value="${record.mode}"]`).checked = true;
    updateQualityNote();
    $('file-name').textContent = selectedFile.name; $('file-size').textContent = size(selectedFile.size);
    $('selected-file').hidden = false; dropZone.hidden = true; compressButton.disabled = false;
    if (completedResult) renderResult();
  } catch { showError('Your saved workspace could not be restored. Please select your PDF again.'); }
  finally { restoring = false; updateWorkspace(); }
}

function updateWorkspace() {
  const hasResult = !$('result-panel').hidden;
  const stage = hasResult ? 'result' : selectedFile ? 'settings' : 'file';
  $('compression-settings').hidden = !selectedFile || busy || hasResult;
  const stages = ['file', 'settings', 'result'];
  document.querySelectorAll('[data-step]').forEach((step) => {
    if (step.dataset.step === stage) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
    step.classList.toggle('is-complete', stages.indexOf(step.dataset.step) < stages.indexOf(stage));
  });
  $('compressor').setAttribute('aria-busy', String(busy));
}

const size = formatSize;
const clearOutput = () => { if (outputUrl) URL.revokeObjectURL(outputUrl); outputUrl = null; completedResult = null; $('result-panel').hidden = true; forgetWorkspace(); };
const showError = (message) => { $('error-message').textContent = t(message); $('error-message').hidden = false; };
const clearError = () => { $('error-message').hidden = true; $('error-message').textContent = ''; };
const setBusy = (value) => { busy = value; modeOptions.disabled = value; compressButton.disabled = value || !selectedFile; $('remove-file').disabled = value; dropZone.setAttribute('aria-disabled', String(value)); $('progress-panel').hidden = !value; compressButton.hidden = value; updateWorkspace(); };

async function selectFile(file) {
  await workspaceReady;
  if (busy || !file) return;
  const version = ++selectionVersion;
  clearError(); clearOutput();
  selectedFile = null; compressButton.disabled = true;
  $('selected-file').hidden = true; dropZone.hidden = false;
  updateWorkspace();
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
    updateWorkspace();
    document.querySelector('input[name="mode"]:checked').focus({ preventScroll: true });
  } catch { if (version === selectionVersion) showError('We could not read this file. Please choose it again.'); }
}

function openFilePicker() {
  if (busy || restoring) return;
  trackButtonClick('choose_pdf_click');
  input.click();
}
dropZone.addEventListener('click', openFilePicker);
dropZone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFilePicker(); } });
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
  if (busy || restoring) return;
  selectionVersion++; selectedFile = null; input.value = ''; clearOutput(); clearError();
  $('selected-file').hidden = true; dropZone.hidden = false; compressButton.hidden = false; compressButton.disabled = true;
  updateWorkspace();
}
$('remove-file').addEventListener('click', () => { reset(); dropZone.focus({ preventScroll: true }); });
$('start-over').addEventListener('click', () => { reset(); dropZone.focus(); });
$('adjust-compression').addEventListener('click', () => {
  if (busy || !selectedFile) return;
  clearOutput(); clearError();
  compressButton.hidden = false;
  updateWorkspace();
  document.querySelector('input[name="mode"]:checked').focus({ preventScroll: true });
});
function updateQualityNote() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  $('quality-note').textContent = t(({ lossless: 'Optimizes PDF structure without deliberately changing image pixels. Already optimized files may not shrink.', recommended: 'Keeps image dimensions and optimizes supported photos. Some image detail may change. Text and vector graphics stay sharp.', stronger: 'Recompresses supported images and may resize large photos to 2,000 pixels on their longest edge. Fine image detail can change.' })[mode]);
}
modeOptions.addEventListener('change', () => {
  clearOutput();
  compressButton.hidden = false;
  compressButton.disabled = busy || !selectedFile;
  updateQualityNote();
  updateWorkspace();
});
$('cancel-button').addEventListener('click', () => { controller?.abort(); $('progress-message').textContent = t('Cancelling…'); $('cancel-button').disabled = true; });

compressButton.addEventListener('click', async () => {
  if (!selectedFile || busy) return;
  trackButtonClick('compress_pdf_click');
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
    completedResult = { blob, smaller, pageCount: result.pageCount,
      name: smaller ? `${file.name.replace(/\.pdf$/i, '')}-${isFrench ? 'compresse' : 'compressed'}.pdf` : file.name };
    renderResult();
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) { $('progress-message').textContent = t('Compression cancelled.'); showError('Compression cancelled. Your original file is unchanged.'); }
    else showError(error.message || 'We could not compress this PDF. Try a different file or a desktop browser.');
  } finally {
    const hasResult = !$('result-panel').hidden;
    setBusy(false); compressButton.hidden = hasResult; controller = null;
    if (hasResult) $('result-title').focus({ preventScroll: true });
    else if (selectedFile) compressButton.focus({ preventScroll: true });
  }
});
window.addEventListener('pagehide', (event) => { controller?.abort(); if (!event.persisted && outputUrl) URL.revokeObjectURL(outputUrl); });
const workspaceReady = restoreWorkspace();
const auth = initAuth({ beforeRedirect: preserveWorkspace, onUserChange: () => { updateDownloadButton(); } });
$('download-button').addEventListener('click', async () => {
  if (downloadBusy || !completedResult || !outputUrl) return;
  trackButtonClick('download_pdf_click');
  downloadBusy = true;
  const currentResult = completedResult;
  $('download-button').disabled = true;
  try {
    // Check the real session on every download, including session expiry/sign-out elsewhere.
    const user = await auth.refreshSession();
    if (currentResult !== completedResult) return;
    if (!user) {
      try { await preserveWorkspace(); } catch { showError(storageError); }
      await auth.open({ forDownload: true }); return;
    }
    const link = document.createElement('a');
    link.href = outputUrl; link.download = completedResult.name;
    document.body.append(link); link.click(); link.remove();
  } catch { showError('We could not verify your sign-in. Your result is still here. Please try again.'); }
  finally { downloadBusy = false; $('download-button').disabled = false; }
});
updateWorkspace();
