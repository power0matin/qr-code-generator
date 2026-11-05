import type { Page } from '@playwright/test';

export interface StoredProjectSnapshot {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly tags: readonly string[];
}

export async function readStoredProjects(page: Page): Promise<readonly StoredProjectSnapshot[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('moduqr', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open the ModuQR IndexedDB database.'));
      request.onblocked = () => reject(new Error('Opening the ModuQR IndexedDB database was blocked.'));
    });

    try {
      return await new Promise<readonly StoredProjectSnapshot[]>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const request = tx.objectStore('projects').getAll();
        let snapshots: readonly StoredProjectSnapshot[] = [];

        request.onsuccess = () => {
          snapshots = (request.result as Array<{
            id: string;
            name: string;
            revision: number;
            tags: readonly string[];
          }>).map(({ id, name, revision, tags }) => ({ id, name, revision, tags }));
        };
        request.onerror = () => reject(request.error ?? new Error('Could not read stored ModuQR projects.'));
        tx.oncomplete = () => resolve(snapshots);
        tx.onerror = () => reject(tx.error ?? new Error('Reading stored ModuQR projects failed.'));
        tx.onabort = () => reject(tx.error ?? new Error('Reading stored ModuQR projects was aborted.'));
      });
    } finally {
      db.close();
    }
  });
}
