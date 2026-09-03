'use client';

import { DESIGN_SCHEMA_VERSION, type QRDesignDocument } from '@moduqr/shared';
import { parseDesignDocument } from '@moduqr/core';

const DB_NAME = 'moduqr';
const STORE = 'projects';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
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

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result: T | undefined;
    let hasResult = false;
    let requestedFailure: unknown = null;
    let settled = false;

    const closeAndResolve = () => {
      if (settled) return;
      settled = true;
      db.close();
      if (!hasResult) {
        reject(new Error('IndexedDB transaction completed without a result.'));
        return;
      }
      resolve(result as T);
    };

    const closeAndReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(error instanceof Error ? error : new Error('IndexedDB transaction failed.'));
    };

    const done = (value: T) => {
      result = value;
      hasResult = true;
    };

    const fail = (error: unknown) => {
      requestedFailure = error;
      try { tx.abort(); } catch { closeAndReject(error); }
    };

    tx.oncomplete = closeAndResolve;
    tx.onerror = () => closeAndReject(requestedFailure ?? tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => closeAndReject(requestedFailure ?? tx.error ?? new Error('IndexedDB transaction was aborted.'));

    try {
      operation(store, done, fail);
    } catch (error) {
      fail(error);
    }
  });
}

export async function saveProject(project: QRDesignDocument): Promise<void> {
  const safe = parseDesignDocument(project);
  await transact<void>('readwrite', (store, done, fail) => {
    const request = store.put(safe);
    request.onsuccess = () => done(undefined);
    request.onerror = () => fail(request.error ?? new Error('Could not save the local project.'));
  });
}

export async function getProject(id: string): Promise<QRDesignDocument | null> {
  if (!id) return null;
  return transact<QRDesignDocument | null>('readonly', (store, done, fail) => {
    const request = store.get(id);
    request.onsuccess = () => {
      try {
        done(request.result === undefined ? null : parseDesignDocument(request.result));
      } catch (error) {
        fail(error);
      }
    };
    request.onerror = () => fail(request.error ?? new Error('Could not read the local project.'));
  });
}

export async function listProjects(): Promise<readonly QRDesignDocument[]> {
  return transact<readonly QRDesignDocument[]>('readonly', (store, done, fail) => {
    const request = store.getAll();
    request.onsuccess = () => {
      try {
        const items = request.result.map(parseDesignDocument).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        done(items);
      } catch (error) {
        fail(error);
      }
    };
    request.onerror = () => fail(request.error ?? new Error('Could not read local projects.'));
  });
}

export async function deleteProject(id: string): Promise<void> {
  await transact<void>('readwrite', (store, done, fail) => {
    const request = store.delete(id);
    request.onsuccess = () => done(undefined);
    request.onerror = () => fail(request.error ?? new Error('Could not delete the local project.'));
  });
}

export function makeProject(input: Omit<QRDesignDocument, 'version' | 'id' | 'createdAt' | 'updatedAt'>): QRDesignDocument {
  const now = new Date().toISOString();
  return { ...input, version: DESIGN_SCHEMA_VERSION, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}

export function duplicateProject(project: QRDesignDocument): QRDesignDocument {
  const now = new Date().toISOString();
  return { ...project, id: crypto.randomUUID(), name: `${project.name} copy`, favorite: false, createdAt: now, updatedAt: now };
}
