/**
 * Resilient Canvas: IndexedDB storage for outbox and snapshot cache.
 * Survives page refresh and crash; restored on startup.
 */

import type { PendingOp } from "./operations";
import type { BoardObjectWithMeta } from "@/lib/board/store";

const DB_NAME = "collabboard-resilient";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";
const SNAPSHOT_STORE = "snapshots";

export type CachedSnapshot = {
  boardId: string;
  objects: Record<string, BoardObjectWithMeta>;
  serverRevision: number;
  timestamp: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: "opId" });
        outbox.createIndex("boardId", "boardId", { unique: false });
        outbox.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "boardId" });
      }
    };
  });
}

export async function outboxEnqueue(op: PendingOp): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    store.put(op);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function outboxGetPending(boardId: string): Promise<PendingOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly");
    const store = tx.objectStore(OUTBOX_STORE);
    const index = store.index("boardId");
    const req = index.getAll(IDBKeyRange.only(boardId));
    req.onsuccess = () => {
      const all = (req.result as PendingOp[]).filter((o) => o.status === "pending");
      all.sort((a, b) => a.createdAt - b.createdAt);
      db.close();
      resolve(all);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function outboxMarkAcked(opId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    const getReq = store.get(opId);
    getReq.onsuccess = () => {
      const op = getReq.result as PendingOp | undefined;
      if (op) {
        op.status = "acked";
        store.put(op);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function outboxMarkFailed(
  opId: string,
  reason: string
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    const getReq = store.get(opId);
    getReq.onsuccess = () => {
      const op = getReq.result as PendingOp | undefined;
      if (op) {
        op.status = "failed";
        op.failureReason = reason;
        store.put(op);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function outboxRemoveAcked(boardId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    const index = store.index("boardId");
    const req = index.openCursor(IDBKeyRange.only(boardId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const op = cursor.value as PendingOp;
        if (op.status === "acked") {
          cursor.delete();
        }
        cursor.continue();
      } else {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      }
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function outboxGetFailed(boardId: string): Promise<PendingOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly");
    const store = tx.objectStore(OUTBOX_STORE);
    const index = store.index("boardId");
    const req = index.getAll(IDBKeyRange.only(boardId));
    req.onsuccess = () => {
      const failed = (req.result as PendingOp[]).filter(
        (o) => o.status === "failed"
      );
      db.close();
      resolve(failed);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function outboxClearFailed(boardId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    const index = store.index("boardId");
    const req = index.openCursor(IDBKeyRange.only(boardId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const op = cursor.value as PendingOp;
        if (op.status === "failed") {
          cursor.delete();
        }
        cursor.continue();
      } else {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      }
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function outboxClearPending(boardId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    const index = store.index("boardId");
    const req = index.openCursor(IDBKeyRange.only(boardId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const op = cursor.value as PendingOp;
        if (op.status === "pending") {
          cursor.delete();
        }
        cursor.continue();
      } else {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      }
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function outboxCount(boardId: string): Promise<{
  pending: number;
  failed: number;
}> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly");
    const store = tx.objectStore(OUTBOX_STORE);
    const index = store.index("boardId");
    const req = index.getAll(IDBKeyRange.only(boardId));
    req.onsuccess = () => {
      const all = req.result as PendingOp[];
      db.close();
      resolve({
        pending: all.filter((o) => o.status === "pending").length,
        failed: all.filter((o) => o.status === "failed").length,
      });
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function snapshotPut(snapshot: CachedSnapshot): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
    tx.objectStore(SNAPSHOT_STORE).put({
      ...snapshot,
      timestamp: Date.now(),
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function snapshotGet(
  boardId: string
): Promise<CachedSnapshot | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, "readonly");
    const req = tx.objectStore(SNAPSHOT_STORE).get(boardId);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
