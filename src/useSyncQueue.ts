// ─────────────────────────────────────────────
// useSyncQueue.ts
// Hook para cola offline con AsyncStorage + NetInfo
// ─────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { SalePayload } from './salesForm.schema';

// ── Tipos ─────────────────────────────────────

export type QueueItemStatus = 'pending' | 'syncing' | 'failed';

export interface QueueItem {
  sale: SalePayload;
  status: QueueItemStatus;
  retries: number;
  lastAttempt?: string;
}

export interface UseSyncQueueReturn {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  addToQueue: (sale: SalePayload) => Promise<void>;
  syncNow: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

// ── Configuración ─────────────────────────────

const QUEUE_STORAGE_KEY = '@sales_sync_queue';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

// ── API helper ────────────────────────────────

async function postSaleToAPI(sale: SalePayload): Promise<void> {
  const response = await fetch('https://tu-api.ejemplo.com/api/sales', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(sale),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorBody}`);
  }
}

// ── Persistencia ──────────────────────────────

async function loadQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

// ── Hook ──────────────────────────────────────

export function useSyncQueue(): UseSyncQueueReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Evita ejecuciones concurrentes de sincronización
  const syncingRef = useRef(false);

  // ── Cargar conteo al montar ──────────────────
  useEffect(() => {
    loadQueue().then((q) => {
      setPendingCount(q.filter((i) => i.status !== 'syncing').length);
    });
  }, []);

  // ── Sincronizar la cola ──────────────────────
  const syncQueue = useCallback(async (): Promise<void> => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const queue = await loadQueue();
      const pending = queue.filter(
        (item) => item.status === 'pending' && item.retries < MAX_RETRIES,
      );

      if (pending.length === 0) return;

      const updatedQueue = [...queue];

      for (const item of pending) {
        const index = updatedQueue.findIndex(
          (q) => q.sale.id === item.sale.id,
        );

        // Marcar como "syncing" en storage
        updatedQueue[index] = { ...item, status: 'syncing' };
        await saveQueue(updatedQueue);

        try {
          await postSaleToAPI(item.sale);

          // Éxito: remover de la cola
          updatedQueue.splice(index, 1);
          await saveQueue(updatedQueue);
        } catch (err) {
          // Falló: volver a pending con retry++
          const newRetries = item.retries + 1;
          updatedQueue[index] = {
            ...item,
            status: newRetries >= MAX_RETRIES ? 'failed' : 'pending',
            retries: newRetries,
            lastAttempt: new Date().toISOString(),
          };
          await saveQueue(updatedQueue);

          // Esperar antes del próximo intento
          await new Promise<void>((res) => setTimeout(() => res(), RETRY_DELAY_MS));
        }
      }

      const finalQueue = await loadQueue();
      setPendingCount(
        finalQueue.filter((i) => i.status === 'pending').length,
      );
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // ── Detectar cambios de conectividad ──────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online =
        state.isConnected === true && state.isInternetReachable === true;
      setIsOnline(online);

      // Al reconectar, intentar sincronizar automáticamente
      if (online) {
        syncQueue();
      }
    });

    return () => unsubscribe();
  }, [syncQueue]);

  // ── Agregar a la cola ──────────────────────────
  const addToQueue = useCallback(
    async (sale: SalePayload): Promise<void> => {
      const queue = await loadQueue();
      const newItem: QueueItem = {
        sale,
        status: 'pending',
        retries: 0,
      };
      const updatedQueue = [...queue, newItem];
      await saveQueue(updatedQueue);
      setPendingCount(updatedQueue.filter((i) => i.status === 'pending').length);

      // Si hay conexión, intentar sincronizar de inmediato
      if (isOnline) {
        syncQueue();
      }
    },
    [isOnline, syncQueue],
  );

  // ── API pública ────────────────────────────────
  const syncNow = useCallback(() => syncQueue(), [syncQueue]);

  const clearQueue = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    setPendingCount(0);
  }, []);

  return { isOnline, isSyncing, pendingCount, addToQueue, syncNow, clearQueue };
}