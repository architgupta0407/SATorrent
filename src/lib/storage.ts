/**
 * Browser IndexedDB storage for SATorrent pieces, manifests, torrent state, and completed files.
 * Ensures that browser refresh does not destroy torrent progress or verified pieces.
 */

import { FileManifest, LocalTorrent } from '../types';

const DB_NAME = 'satorrent_db';
const DB_VERSION = 2; // Incremented for persistent torrent state store

const STORE_PIECES = 'pieces';
const STORE_MANIFESTS = 'manifests';
const STORE_COMPLETED = 'completed_files';
const STORE_TORRENT_STATE = 'torrent_state';

export interface StoredCompletedFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  overallSha256: string;
  completedAt: number;
  blob: Blob;
}

export interface StoredTorrentState {
  fileId: string;
  manifest: FileManifest;
  isSeeder: boolean;
  verifiedPieceIndices: number[];
  overallSha256Status: 'pending' | 'verified' | 'mismatch';
  completedAt?: number;
  updatedAt: number;
}

class SwarmStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not available in this environment'));
        return;
      }

      const req = window.indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PIECES)) {
          db.createObjectStore(STORE_PIECES); // key: `${fileId}_${pieceIndex}`
        }
        if (!db.objectStoreNames.contains(STORE_MANIFESTS)) {
          db.createObjectStore(STORE_MANIFESTS, { keyPath: 'fileId' });
        }
        if (!db.objectStoreNames.contains(STORE_COMPLETED)) {
          db.createObjectStore(STORE_COMPLETED, { keyPath: 'fileId' });
        }
        if (!db.objectStoreNames.contains(STORE_TORRENT_STATE)) {
          db.createObjectStore(STORE_TORRENT_STATE, { keyPath: 'fileId' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  async savePiece(fileId: string, pieceIndex: number, data: ArrayBuffer): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PIECES, 'readwrite');
        const store = tx.objectStore(STORE_PIECES);
        const key = `${fileId}_${pieceIndex}`;
        const req = store.put(data, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Storage savePiece error:', err);
    }
  }

  async getPiece(fileId: string, pieceIndex: number): Promise<ArrayBuffer | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PIECES, 'readonly');
        const store = tx.objectStore(STORE_PIECES);
        const key = `${fileId}_${pieceIndex}`;
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async saveManifest(manifest: FileManifest): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MANIFESTS, 'readwrite');
        const store = tx.objectStore(STORE_MANIFESTS);
        const req = store.put(manifest);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Storage saveManifest error:', err);
    }
  }

  async getManifest(fileId: string): Promise<FileManifest | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MANIFESTS, 'readonly');
        const store = tx.objectStore(STORE_MANIFESTS);
        const req = store.get(fileId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async saveTorrentState(state: StoredTorrentState): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_TORRENT_STATE, 'readwrite');
        const store = tx.objectStore(STORE_TORRENT_STATE);
        const req = store.put(state);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Storage saveTorrentState error:', err);
    }
  }

  async getAllTorrentStates(): Promise<StoredTorrentState[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_TORRENT_STATE, 'readonly');
        const store = tx.objectStore(STORE_TORRENT_STATE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async deleteTorrentState(fileId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_TORRENT_STATE, 'readwrite');
        const store = tx.objectStore(STORE_TORRENT_STATE);
        const req = store.delete(fileId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Storage deleteTorrentState error:', err);
    }
  }

  async saveCompletedFile(file: StoredCompletedFile): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COMPLETED, 'readwrite');
        const store = tx.objectStore(STORE_COMPLETED);
        const req = store.put(file);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Storage saveCompletedFile error:', err);
    }
  }

  async getAllCompletedFiles(): Promise<StoredCompletedFile[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COMPLETED, 'readonly');
        const store = tx.objectStore(STORE_COMPLETED);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async deleteCompletedFile(fileId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COMPLETED, 'readwrite');
        const store = tx.objectStore(STORE_COMPLETED);
        const req = store.delete(fileId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Storage deleteCompletedFile error:', err);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(
          [STORE_PIECES, STORE_MANIFESTS, STORE_COMPLETED, STORE_TORRENT_STATE],
          'readwrite'
        );
        tx.objectStore(STORE_PIECES).clear();
        tx.objectStore(STORE_MANIFESTS).clear();
        tx.objectStore(STORE_COMPLETED).clear();
        tx.objectStore(STORE_TORRENT_STATE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Storage clearAll error:', err);
    }
  }
}

export const storage = new SwarmStorage();
