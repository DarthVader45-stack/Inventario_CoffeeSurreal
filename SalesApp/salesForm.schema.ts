// ─────────────────────────────────────────────
// salesForm.schema.ts
// Estructura JSON del formulario + validaciones Yup
// ─────────────────────────────────────────────
import * as Yup from 'yup';

// ── 1. Tipos ──────────────────────────────────

export type Vendedor = 'Armando' | 'Melvi' | 'Francisco' | 'Karla' | 'Oscar';

export type TipoCafe =
  | 'Espresso'
  | 'Americano'
  | 'Cappuccino'
  | 'Latte'
  | 'Cold Brew'
  | 'Otro';

export interface SaleFormValues {
  // Pantalla 1
  vendedor: Vendedor | '';
  fecha: string;           // ISO date string "YYYY-MM-DD"
  // Pantalla 2
  tipoCafe: TipoCafe | '';
  producto: string;
  precioUnitario: number | '';
  cantidadVendida: number | '';
  // Calculado
  montoTotal?: number;
}

export interface SalePayload extends Omit<SaleFormValues, 'montoTotal'> {
  vendedor: Vendedor;
  tipoCafe: TipoCafe;
  precioUnitario: number;
  cantidadVendida: number;
  montoTotal: number;
  id: string;              // uuid local
  createdAt: string;       // ISO timestamp
  syncedAt?: string;       // ISO timestamp cuando se sincronizó
}

// ── 2. Constantes ─────────────────────────────

export const VENDEDORES: Vendedor[] = [
  'Armando', 'Melvi', 'Francisco', 'Karla', 'Oscar',
];

export const TIPOS_CAFE: TipoCafe[] = [
  'Espresso', 'Americano', 'Cappuccino', 'Latte', 'Cold Brew', 'Otro',
];

// ── 3. JSON del formulario ────────────────────
// Descripción declarativa de cada campo (útil para generación dinámica de UI)

export const FORM_SCHEMA_JSON = {
  screens: [
    {
      step: 1,
      title: 'Seleccionar vendedor',
      fields: [
        {
          id: 'vendedor',
          type: 'picker',
          label: 'Vendedor',
          options: VENDEDORES,
          required: true,
          placeholder: 'Selecciona un vendedor',
        },
        {
          id: 'fecha',
          type: 'date',
          label: 'Fecha de venta',
          required: true,
          placeholder: 'YYYY-MM-DD',
          constraints: { noFuture: true },
        },
      ],
    },
    {
      step: 2,
      title: 'Producto y cantidad',
      fields: [
        {
          id: 'tipoCafe',
          type: 'picker',
          label: 'Tipo de café',
          options: TIPOS_CAFE,
          required: true,
          placeholder: 'Selecciona el tipo',
        },
        {
          id: 'producto',
          type: 'text',
          label: 'Producto',
          required: true,
          placeholder: 'Ej: Café molido 250g',
          maxLength: 100,
        },
        {
          id: 'precioUnitario',
          type: 'decimal',
          label: 'Precio unitario (USD)',
          required: true,
          placeholder: '0.00',
          constraints: { min: 0.01 },
        },
        {
          id: 'cantidadVendida',
          type: 'integer',
          label: 'Cantidad vendida',
          required: true,
          placeholder: '1',
          constraints: { min: 1, integer: true },
        },
      ],
    },
    {
      step: 3,
      title: 'Confirmación',
      type: 'summary',
      computed: [
        {
          id: 'montoTotal',
          label: 'Monto total',
          formula: 'precioUnitario * cantidadVendida',
          format: 'currency',
        },
      ],
    },
  ],
} as const;

// ── 4. Esquema Yup por pantalla ───────────────

// Helper: fecha no futura
const hoy = (): string => new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

export const schemaStep1 = Yup.object({
  // Transform '' → undefined so required() fires before oneOf() for empty values
  vendedor: Yup.string()
    .transform((v) => (v === '' ? undefined : v))
    .required('El vendedor es obligatorio')
    .oneOf(VENDEDORES as unknown as string[], 'Selecciona un vendedor válido'),

  fecha: Yup.string()
    .required('La fecha es obligatoria')
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .test('no-future', 'La fecha no puede ser futura', (value) => {
      if (!value) return false;
      return value <= hoy();
    }),
});

export const schemaStep2 = Yup.object({
  tipoCafe: Yup.string()
    .oneOf(TIPOS_CAFE as unknown as string[], 'Tipo de café inválido')
    .required('El tipo de café es obligatorio'),

  producto: Yup.string()
    .trim()
    .min(2, 'El producto debe tener al menos 2 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .required('El producto es obligatorio'),

  // .min(0.01) enforces both zero and negative values — .positive() is redundant
  precioUnitario: Yup.number()
    .typeError('Ingresa un número válido')
    .min(0.01, 'El precio mínimo es $0.01')
    .required('El precio unitario es obligatorio'),

  cantidadVendida: Yup.number()
    .typeError('Ingresa un número válido')
    .integer('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima es 1')
    .required('La cantidad es obligatoria'),
});

// Esquema completo (para validación final antes de envío)
export const schemaCompleto = schemaStep1.concat(schemaStep2);

// ── 5. Valores iniciales ──────────────────────

export const initialValues: SaleFormValues = {
  vendedor: '',
  fecha: hoy(),
  tipoCafe: '',
  producto: '',
  precioUnitario: '',
  cantidadVendida: '',
};

// ── 6. Utilidad de cálculo ────────────────────

export const calcularMontoTotal = (
  precio: number | '',
  cantidad: number | '',
): number => {
  if (!precio || !cantidad) return 0;
  return Math.round(Number(precio) * Number(cantidad) * 100) / 100;
};
