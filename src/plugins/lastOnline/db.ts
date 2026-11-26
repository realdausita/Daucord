/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface PresenceStatus {
    hasBeenOnline: boolean;
    lastOffline: number | null;
}

const DB_NAME = "LastOnlineIDB";
const DB_VERSION = 1;
const STORE = "presence";

let dbPromise: Promise<IDBDatabase> | undefined;

function getDb() {
    return dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "userId" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = undefined;
            reject(request.error);
        };
    });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getAllPresence(): Promise<Record<string, PresenceStatus>> {
    const db = await getDb();
    const records = await requestToPromise<Array<PresenceStatus & { userId: string; }>>(
        db.transaction(STORE, "readonly").objectStore(STORE).getAll()
    );
    return Object.fromEntries(records.map(r => [r.userId, { hasBeenOnline: r.hasBeenOnline, lastOffline: r.lastOffline }]));
}

export async function putPresenceBatch(entries: Array<[string, PresenceStatus]>) {
    if (!entries.length) return;
    const db = await getDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const [userId, status] of entries) store.put({ userId, ...status });
    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

export async function delPresenceBatch(userIds: Array<string>) {
    if (!userIds.length) return;
    const db = await getDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const userId of userIds) store.delete(userId);
    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}
