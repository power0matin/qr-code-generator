'use client';

import { DESIGN_SCHEMA_VERSION, type QRDesignDocument } from '@moduqr/shared';
import { parseDesignDocument } from '@moduqr/core';

const DB_NAME = 'moduqr';
const STORE = 'projects';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open local project database.'));
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      operation(store, resolve, reject);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    });
  } finally {
    db.close();
  }
}

export async function saveProject(project: QRDesignDocument): Promise<void> {
  const safe = parseDesignDocument(project);
  await transact<void>('readwrite', (store, done, fail) => {
    const req = store.put(safe);
    req.onsuccess = () => done();
    req.onerror = () => fail(req.error);
  });
}

export async function listProjects(): Promise<readonly QRDesignDocument[]> {
  return transact<readonly QRDesignDocument[]>('readonly', (store, done, fail) => {
    const req = store.getAll();
    req.onsuccess = () => {
      try {
        const items = req.result.map(parseDesignDocument).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        done(items);
      } catch (error) {
        fail(error);
      }
    };
    req.onerror = () => fail(req.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  await transact<void>('readwrite', (store, done, fail) => {
    const req = store.delete(id);
    req.onsuccess = () => done();
    req.onerror = () => fail(req.error);
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
