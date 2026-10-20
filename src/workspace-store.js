// Only the browser stores PDF bytes. The random resume ID contains no file metadata.
const databaseName = 'pdf-workspace';
const storeName = 'pending';
const lifetime = 60 * 60 * 1000;
const sessionKey = 'pdf-workspace-resume';
const validID = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Browser storage is blocked.'));
  });
}

async function transaction(mode, operate) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const result = operate(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Browser storage is unavailable.'));
    });
  } finally { db.close(); }
}

export function resumeID() {
  const queryID = new URLSearchParams(location.search).get('workspace');
  if (validID(queryID)) return queryID;
  try { const id = sessionStorage.getItem(sessionKey); return validID(id) ? id : null; }
  catch { return null; }
}

export function newResumeID() { return crypto.randomUUID(); }

export async function saveWorkspace(id, workspace) {
  if (!validID(id)) throw new Error('Invalid workspace.');
  // Remove expired entries opportunistically; expired entries are never restored.
  await transaction('readwrite', store => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.expiresAt <= Date.now()) cursor.delete();
      cursor.continue();
    };
  });
  // Commit cleanup before the replacement, so an expired cursor cannot delete
  // a newly saved record with the same ID.
  await transaction('readwrite', store => store.put({ ...workspace, id, expiresAt: Date.now() + lifetime }));
  try { sessionStorage.setItem(sessionKey, id); } catch { /* callback URL also carries the ID */ }
}

export async function loadWorkspace(id) {
  if (!validID(id)) return null;
  const record = await transaction('readonly', store => store.get(id));
  if (!record) return null;
  if (record.expiresAt <= Date.now()) { await deleteWorkspace(id); return null; }
  if (!(record.original instanceof Blob) || !record.original.size || record.original.size > 100 * 1024 * 1024 ||
      typeof record.name !== 'string' || !['lossless', 'recommended', 'stronger'].includes(record.mode) ||
      (record.result && (!(record.result.blob instanceof Blob) || record.result.blob.size > record.original.size))) {
    await deleteWorkspace(id); return null;
  }
  try { sessionStorage.setItem(sessionKey, id); } catch { /* optional */ }
  return record;
}

export async function deleteWorkspace(id) {
  if (!validID(id)) return;
  await transaction('readwrite', store => store.delete(id));
  try { if (sessionStorage.getItem(sessionKey) === id) sessionStorage.removeItem(sessionKey); } catch { /* optional */ }
}
