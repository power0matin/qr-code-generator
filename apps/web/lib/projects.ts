'use client';

import { parseDesignDocument } from '@moduqr/core';
import { DESIGN_SCHEMA_VERSION, type ProjectRevision, type QRDesignDocument } from '@moduqr/shared';

const DB_NAME = 'moduqr';
const PROJECT_STORE = 'projects';
const HISTORY_STORE = 'project-history';
const HISTORY_PROJECT_INDEX = 'projectId';
const DB_VERSION = 2;
const MAX_REVISIONS = 40;

interface StoredRevision extends ProjectRevision {
  readonly key: string;
  readonly projectId: string;
}

function historyKey(projectId: string, revision: number): string {
  return `${projectId}:${String(revision).padStart(8, '0')}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const history = db.createObjectStore(HISTORY_STORE, { keyPath: 'key' });
        history.createIndex(HISTORY_PROJECT_INDEX, 'projectId', { unique: false });
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error('Failed to open local project database.'));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error('Local project database is blocked by another open ModuQR tab. Close other tabs and try again.'));
    };
  });
}

function awaitTransaction(db: IDBDatabase, tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      db.close();
      if (error) reject(error instanceof Error ? error : new Error('IndexedDB transaction failed.'));
      else resolve();
    };
    tx.oncomplete = () => finish();
    tx.onerror = () => finish(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => finish(tx.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

function requestValue<T>(request: IDBRequest<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(message));
  });
}

export async function saveProject(project: QRDesignDocument): Promise<void> {
  const safe = parseDesignDocument(project);
  const db = await openDb();
  const tx = db.transaction([PROJECT_STORE, HISTORY_STORE], 'readwrite');
  const done = awaitTransaction(db, tx);
  const projects = tx.objectStore(PROJECT_STORE);
  const history = tx.objectStore(HISTORY_STORE);

  projects.put(safe);
  const storedRevision: StoredRevision = {
    key: historyKey(safe.id, safe.revision),
    projectId: safe.id,
    revision: safe.revision,
    savedAt: safe.updatedAt,
    document: safe,
  };
  history.put(storedRevision);

  const revisionsRequest = history.index(HISTORY_PROJECT_INDEX).getAll(IDBKeyRange.only(safe.id));
  revisionsRequest.onsuccess = () => {
    const revisions = (revisionsRequest.result as StoredRevision[]).sort((a, b) => b.revision - a.revision);
    for (const stale of revisions.slice(MAX_REVISIONS)) history.delete(stale.key);
  };

  await done;
}

export async function getProject(id: string): Promise<QRDesignDocument | null> {
  if (!id) return null;
  const db = await openDb();
  const tx = db.transaction(PROJECT_STORE, 'readonly');
  const done = awaitTransaction(db, tx);
  try {
    const value = await requestValue(tx.objectStore(PROJECT_STORE).get(id), 'Could not read the local project.');
    const result = value === undefined ? null : parseDesignDocument(value);
    await done;
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* transaction may already be complete */ }
    await done.catch(() => undefined);
    throw error;
  }
}

export async function listProjects(): Promise<readonly QRDesignDocument[]> {
  const db = await openDb();
  const tx = db.transaction(PROJECT_STORE, 'readonly');
  const done = awaitTransaction(db, tx);
  try {
    const values = await requestValue(tx.objectStore(PROJECT_STORE).getAll(), 'Could not read local projects.');
    const items = values.map(parseDesignDocument).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    await done;
    return items;
  } catch (error) {
    try { tx.abort(); } catch { /* transaction may already be complete */ }
    await done.catch(() => undefined);
    throw error;
  }
}

export async function listProjectHistory(projectId: string): Promise<readonly ProjectRevision[]> {
  if (!projectId) return [];
  const db = await openDb();
  const tx = db.transaction(HISTORY_STORE, 'readonly');
  const done = awaitTransaction(db, tx);
  try {
    const values = await requestValue(
      tx.objectStore(HISTORY_STORE).index(HISTORY_PROJECT_INDEX).getAll(IDBKeyRange.only(projectId)),
      'Could not read project history.',
    );
    const revisions = (values as StoredRevision[])
      .map((entry) => ({ projectId: entry.projectId, revision: entry.revision, savedAt: entry.savedAt, document: parseDesignDocument(entry.document) }))
      .sort((a, b) => b.revision - a.revision)
      .slice(0, MAX_REVISIONS);
    await done;
    return revisions;
  } catch (error) {
    try { tx.abort(); } catch { /* transaction may already be complete */ }
    await done.catch(() => undefined);
    throw error;
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PROJECT_STORE, HISTORY_STORE], 'readwrite');
  const done = awaitTransaction(db, tx);
  tx.objectStore(PROJECT_STORE).delete(id);
  const history = tx.objectStore(HISTORY_STORE);
  const keysRequest = history.index(HISTORY_PROJECT_INDEX).getAllKeys(IDBKeyRange.only(id));
  keysRequest.onsuccess = () => {
    for (const key of keysRequest.result) history.delete(key);
  };
  await done;
}

export function normalizeProjectTags(tags: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const value = tag.trim().replace(/\s+/g, ' ').slice(0, 32);
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= 12) break;
  }
  return result;
}

export function makeProject(input: Omit<QRDesignDocument, 'version' | 'id' | 'createdAt' | 'updatedAt' | 'revision'>): QRDesignDocument {
  const now = new Date().toISOString();
  return {
    ...input,
    tags: normalizeProjectTags(input.tags),
    revision: 1,
    version: DESIGN_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateProject(project: QRDesignDocument): QRDesignDocument {
  const now = new Date().toISOString();
  return {
    ...project,
    id: crypto.randomUUID(),
    name: `${project.name} copy`,
    favorite: false,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}
