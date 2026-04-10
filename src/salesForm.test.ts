// tests/salesForm.test.ts
// Ensure mocks are defined before any imports
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    fetch: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as Yup from 'yup';

import {
  calcularMontoTotal,
  schemaCompleto,
  schemaStep1,
  schemaStep2,
} from './salesForm.schema';
import { useSyncQueue } from './useSyncQueue';

// Normalize mock shape (works whether module exports default or named)
const MockedNetInfo = ((NetInfo as any).default ?? NetInfo) as {
  addEventListener: jest.Mock;
  fetch?: jest.Mock;
};

const MockedStorage = ((AsyncStorage as any).default ?? AsyncStorage) as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

// Test-scoped in-memory store to make AsyncStorage mocks resilient
let storedQueue: string | null = null;

function setupStorageMocks() {
  storedQueue = null;

  MockedStorage.getItem.mockImplementation(async (key: string) => {
    if (key === '@sales_sync_queue') return storedQueue;
    return null;
  });

  MockedStorage.setItem.mockImplementation(async (key: string, value: string) => {
    if (key === '@sales_sync_queue') storedQueue = value;
    return undefined;
  });

  MockedStorage.removeItem.mockImplementation(async (key: string) => {
    if (key === '@sales_sync_queue') storedQueue = null;
    return undefined;
  });
}

// Helpers de mock para NetInfo
function mockOnline() {
  MockedNetInfo.addEventListener.mockImplementation((handler: (s: any) => void) => {
    // call handler asynchronously to better match real behavior
    setTimeout(() => handler({ isConnected: true, isInternetReachable: true }), 0);
    return jest.fn();
  });
}

function mockOffline() {
  MockedNetInfo.addEventListener.mockImplementation((handler: (s: any) => void) => {
    setTimeout(() => handler({ isConnected: false, isInternetReachable: false }), 0);
    return jest.fn();
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 1. VALIDACIONES — Pantalla 1
// ────────────────────────────────────────────────────────────────────────────

describe('schemaStep1 — vendedor + fecha', () => {
  const BASE = { vendedor: 'Armando', fecha: '2024-03-15' };

  it('pasa con datos válidos', async () => {
    await expect(schemaStep1.validate(BASE)).resolves.toBeDefined();
  });

  it('falla si vendedor es vacío', async () => {
    await expect(
      schemaStep1.validate({ ...BASE, vendedor: '' }),
    ).rejects.toThrow('El vendedor es obligatorio');
  });

  it('falla si vendedor no está en la lista', async () => {
    await expect(
      schemaStep1.validate({ ...BASE, vendedor: 'Pedro' }),
    ).rejects.toThrow('Selecciona un vendedor válido');
  });

  it('falla si fecha es futura', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = tomorrow.toISOString().split('T')[0];

    await expect(
      schemaStep1.validate({ ...BASE, fecha: futureDate }),
    ).rejects.toThrow('La fecha no puede ser futura');
  });

  it('falla si fecha tiene formato inválido', async () => {
    await expect(
      schemaStep1.validate({ ...BASE, fecha: '15/03/2024' }),
    ).rejects.toThrow('Formato de fecha inválido');
  });

  it('falla si fecha es vacía', async () => {
    await expect(
      schemaStep1.validate({ ...BASE, fecha: '' }),
    ).rejects.toThrow('La fecha es obligatoria');
  });

  it('acepta la fecha de hoy', async () => {
    const today = new Date().toISOString().split('T')[0];
    await expect(
      schemaStep1.validate({ ...BASE, fecha: today }),
    ).resolves.toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. VALIDACIONES — Pantalla 2
// ────────────────────────────────────────────────────────────────────────────

describe('schemaStep2 — producto + precio + cantidad', () => {
  const BASE = {
    tipoCafe: 'Espresso',
    producto: 'Café molido 250g',
    precioUnitario: 5.5,
    cantidadVendida: 3,
  };

  it('pasa con datos válidos', async () => {
    await expect(schemaStep2.validate(BASE)).resolves.toBeDefined();
  });

  it('falla si precio es 0', async () => {
    await expect(
      schemaStep2.validate({ ...BASE, precioUnitario: 0 }),
    ).rejects.toThrow('El precio mínimo es $0.01');
  });

  it('falla si precio es negativo', async () => {
    await expect(
      schemaStep2.validate({ ...BASE, precioUnitario: -10 }),
    ).rejects.toThrow('El precio mínimo es $0.01');
  });

  it('falla si cantidad es 0', async () => {
    await expect(
      schemaStep2.validate({ ...BASE, cantidadVendida: 0 }),
    ).rejects.toThrow('La cantidad mínima es 1');
  });

  it('falla si cantidad es decimal', async () => {
    await expect(
      schemaStep2.validate({ ...BASE, cantidadVendida: 2.5 }),
    ).rejects.toThrow('La cantidad debe ser un número entero');
  });

  it('falla si cantidad es negativa', async () => {
    await expect(
      schemaStep2.validate({ ...BASE, cantidadVendida: -1 }),
    ).rejects.toThrow('La cantidad mínima es 1');
  });

  it('falla si producto es muy corto', async () => {
    await expect(
      schemaStep2.validate({ ...BASE, producto: 'A' }),
    ).rejects.toThrow('El producto debe tener al menos 2 caracteres');
  });

  it('falla si producto supera 100 caracteres', async () => {
    await expect(
      schemaStep2.validate({ ...BASE, producto: 'A'.repeat(101) }),
    ).rejects.toThrow('Máximo 100 caracteres');
  });

  it('falla si tipoCafe no está en la lista', async () => {
    await expect(
      schemaStep2.validate({ ...BASE, tipoCafe: 'Mocha' }),
    ).rejects.toThrow('Tipo de café inválido');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. CÁLCULO DE MONTO TOTAL
// ────────────────────────────────────────────────────────────────────────────

describe('calcularMontoTotal', () => {
  it('calcula correctamente con enteros', () => {
    expect(calcularMontoTotal(5, 3)).toBe(15);
  });

  it('calcula correctamente con decimales', () => {
    expect(calcularMontoTotal(2.75, 4)).toBe(11);
  });

  it('redondea a 2 decimales evitando errores de punto flotante', () => {
    expect(calcularMontoTotal(1.1, 3)).toBe(3.3);
  });

  it('devuelve 0 si precio es vacío', () => {
    expect(calcularMontoTotal('', 5)).toBe(0);
  });

  it('devuelve 0 si cantidad es vacía', () => {
    expect(calcularMontoTotal(5, '')).toBe(0);
  });

  it('devuelve 0 si ambos son vacíos', () => {
    expect(calcularMontoTotal('', '')).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. ESQUEMA COMPLETO
// ────────────────────────────────────────────────────────────────────────────

describe('schemaCompleto — validación end-to-end', () => {
  const VALID_PAYLOAD = {
    vendedor: 'Karla',
    fecha: '2024-03-10',
    tipoCafe: 'Latte',
    producto: 'Café tostado oscuro',
    precioUnitario: 8.99,
    cantidadVendida: 2,
  };

  it('valida un payload completo correcto', async () => {
    await expect(schemaCompleto.validate(VALID_PAYLOAD)).resolves.toBeDefined();
  });

  it('recoge todos los errores en modo abortEarly: false', async () => {
    const invalid = {
      vendedor: '',
      fecha: '',
      tipoCafe: '',
      producto: '',
      precioUnitario: 0,
      cantidadVendida: 0,
    };

    const result = await schemaCompleto
      .validate(invalid, { abortEarly: false })
      .catch((e: Yup.ValidationError) => e);

    expect(result instanceof Yup.ValidationError).toBe(true);
    expect((result as Yup.ValidationError).inner.length).toBeGreaterThan(3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. INTEGRACIÓN — useSyncQueue
// ────────────────────────────────────────────────────────────────────────────

const MOCK_SALE = {
  id: 'abc-123',
  vendedor: 'Melvi' as const,
  tipoCafe: 'Americano' as const,
  producto: 'Café test',
  precioUnitario: 10,
  cantidadVendida: 1,
  montoTotal: 10,
  fecha: '2024-03-01',
  createdAt: new Date().toISOString(),
};

describe('useSyncQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupStorageMocks();
    mockOnline();
  });

  it('inicia con pendingCount 0', async () => {
    const { result } = renderHook(() => useSyncQueue());

    await waitFor(() => expect(result.current.pendingCount).toBe(0));
  });

  it('isOnline es true cuando NetInfo reporta conexión', async () => {
    const { result } = renderHook(() => useSyncQueue());

    await waitFor(() => expect(result.current.isOnline).toBe(true));
  });

  it('isOnline es false cuando NetInfo reporta sin conexión', async () => {
    mockOffline();
    const { result } = renderHook(() => useSyncQueue());

    await waitFor(() => expect(result.current.isOnline).toBe(false));
  });

  it('addToQueue incrementa pendingCount cuando está offline', async () => {
    mockOffline();
    storedQueue = null;

    const { result } = renderHook(() => useSyncQueue());

    await act(async () => {
      await result.current.addToQueue(MOCK_SALE);
    });

    await waitFor(() => expect(result.current.pendingCount).toBe(1));

    expect(MockedStorage.setItem).toHaveBeenCalled();
    expect(MockedStorage.setItem).toHaveBeenCalledWith(
      '@sales_sync_queue',
      JSON.stringify([{ sale: MOCK_SALE, status: 'pending', retries: 0 }]),
    );
  });

  it('clearQueue resetea pendingCount a 0', async () => {
    const { result } = renderHook(() => useSyncQueue());

    await act(async () => {
      await result.current.clearQueue();
    });

    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(MockedStorage.removeItem).toHaveBeenCalledWith('@sales_sync_queue');
  });
});
