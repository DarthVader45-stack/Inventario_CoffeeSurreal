// ─────────────────────────────────────────────
// SalesFormScreen.tsx
// Componente completo: 3 pantallas con Formik + Yup + AsyncStorage
// ─────────────────────────────────────────────
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import {
  calcularMontoTotal,
  initialValues,
  SaleFormValues,
  SalePayload,
  schemaStep1,
  schemaStep2,
  TIPOS_CAFE,
  VENDEDORES,
} from './salesForm.schema';
import { useSyncQueue } from './useSyncQueue';

// ── Sub-componentes de campo ───────────────────

interface FieldWrapperProps {
  label: string;
  error?: string;
  touched?: boolean;
  children: React.ReactNode;
}

const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  error,
  touched,
  children,
}) => {
  const hasError = touched && !!error;
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// ── Pantalla 1: Vendedor ───────────────────────

interface Screen1Props {
  values: SaleFormValues;
  errors: Partial<Record<keyof SaleFormValues, string>>;
  touched: Partial<Record<keyof SaleFormValues, boolean>>;
  setFieldValue: (field: string, value: unknown) => void;
  setFieldTouched: (field: string, touched?: boolean) => void;
  onNext: () => void;
}

const Screen1: React.FC<Screen1Props> = ({
  values,
  errors,
  touched,
  setFieldValue,
  setFieldTouched,
  onNext,
}) => (
  <View style={styles.screen}>
    <Text style={styles.screenTitle}>Paso 1 — Vendedor</Text>

    <FieldWrapper
      label="Vendedor"
      error={errors.vendedor}
      touched={touched.vendedor}
    >
      <View style={[styles.pickerWrapper, touched.vendedor && errors.vendedor && styles.inputError]}>
        <Picker
          selectedValue={values.vendedor}
          onValueChange={(v) => {
            setFieldValue('vendedor', v);
            setFieldTouched('vendedor', true);
          }}
          testID="picker-vendedor"
        >
          <Picker.Item label="Selecciona un vendedor…" value="" />
          {VENDEDORES.map((v) => (
            <Picker.Item key={v} label={v} value={v} />
          ))}
        </Picker>
      </View>
    </FieldWrapper>

    <FieldWrapper
      label="Fecha de venta"
      error={errors.fecha}
      touched={touched.fecha}
    >
      <TextInput
        style={[styles.input, touched.fecha && errors.fecha && styles.inputError]}
        value={values.fecha}
        onChangeText={(v) => setFieldValue('fecha', v)}
        onBlur={() => setFieldTouched('fecha', true)}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        testID="input-fecha"
      />
    </FieldWrapper>

    <Pressable style={styles.btnPrimary} onPress={onNext} testID="btn-step1-next">
      <Text style={styles.btnPrimaryText}>Continuar →</Text>
    </Pressable>
  </View>
);

// ── Pantalla 2: Producto ───────────────────────

interface Screen2Props {
  values: SaleFormValues;
  errors: Partial<Record<keyof SaleFormValues, string>>;
  touched: Partial<Record<keyof SaleFormValues, boolean>>;
  setFieldValue: (field: string, value: unknown) => void;
  setFieldTouched: (field: string, touched?: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

const Screen2: React.FC<Screen2Props> = ({
  values,
  errors,
  touched,
  setFieldValue,
  setFieldTouched,
  onBack,
  onNext,
}) => (
  <View style={styles.screen}>
    <Text style={styles.screenTitle}>Paso 2 — Producto</Text>

    <FieldWrapper
      label="Tipo de café"
      error={errors.tipoCafe}
      touched={touched.tipoCafe}
    >
      <View style={[styles.pickerWrapper, touched.tipoCafe && errors.tipoCafe && styles.inputError]}>
        <Picker
          selectedValue={values.tipoCafe}
          onValueChange={(v) => {
            setFieldValue('tipoCafe', v);
            setFieldTouched('tipoCafe', true);
          }}
          testID="picker-tipoCafe"
        >
          <Picker.Item label="Selecciona el tipo…" value="" />
          {TIPOS_CAFE.map((t) => (
            <Picker.Item key={t} label={t} value={t} />
          ))}
        </Picker>
      </View>
    </FieldWrapper>

    <FieldWrapper
      label="Producto"
      error={errors.producto}
      touched={touched.producto}
    >
      <TextInput
        style={[styles.input, touched.producto && errors.producto && styles.inputError]}
        value={values.producto}
        onChangeText={(v) => setFieldValue('producto', v)}
        onBlur={() => setFieldTouched('producto', true)}
        placeholder="Ej: Café molido 250g"
        testID="input-producto"
      />
    </FieldWrapper>

    <FieldWrapper
      label="Precio unitario (USD)"
      error={errors.precioUnitario as string}
      touched={touched.precioUnitario}
    >
      <TextInput
        style={[styles.input, touched.precioUnitario && errors.precioUnitario && styles.inputError]}
        value={values.precioUnitario === '' ? '' : String(values.precioUnitario)}
        onChangeText={(v) => setFieldValue('precioUnitario', v === '' ? '' : parseFloat(v))}
        onBlur={() => setFieldTouched('precioUnitario', true)}
        placeholder="0.00"
        keyboardType="decimal-pad"
        testID="input-precio"
      />
    </FieldWrapper>

    <FieldWrapper
      label="Cantidad vendida"
      error={errors.cantidadVendida as string}
      touched={touched.cantidadVendida}
    >
      <TextInput
        style={[styles.input, touched.cantidadVendida && errors.cantidadVendida && styles.inputError]}
        value={values.cantidadVendida === '' ? '' : String(values.cantidadVendida)}
        onChangeText={(v) => setFieldValue('cantidadVendida', v === '' ? '' : parseInt(v, 10))}
        onBlur={() => setFieldTouched('cantidadVendida', true)}
        placeholder="1"
        keyboardType="number-pad"
        testID="input-cantidad"
      />
    </FieldWrapper>

    <View style={styles.row}>
      <Pressable style={[styles.btnSecondary, { flex: 1 }]} onPress={onBack}>
        <Text style={styles.btnSecondaryText}>← Atrás</Text>
      </Pressable>
      <View style={{ width: 12 }} />
      <Pressable style={[styles.btnPrimary, { flex: 2 }]} onPress={onNext} testID="btn-step2-next">
        <Text style={styles.btnPrimaryText}>Revisar →</Text>
      </Pressable>
    </View>
  </View>
);

// ── Pantalla 3: Confirmación ───────────────────

interface Screen3Props {
  values: SaleFormValues;
  isSubmitting: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  onBack: () => void;
  onSubmit: () => void;
}

const Screen3: React.FC<Screen3Props> = ({
  values,
  isSubmitting,
  isOnline,
  isSyncing,
  pendingCount,
  onBack,
  onSubmit,
}) => {
  const monto = calcularMontoTotal(values.precioUnitario, values.cantidadVendida);

  return (
    <View style={styles.screen}>
      <Text style={styles.screenTitle}>Paso 3 — Confirmación</Text>

      {/* Estado de conexión */}
      <View style={[styles.statusBanner, isOnline ? styles.statusOnline : styles.statusOffline]}>
        <Text style={[styles.statusText, isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>
          {isOnline
            ? isSyncing
              ? `Sincronizando ${pendingCount} venta(s) pendiente(s)…`
              : 'En línea — envío inmediato'
            : `Sin conexión — se guardará en cola (${pendingCount} pendiente(s))`}
        </Text>
      </View>

      {/* Resumen */}
      <View style={styles.summaryCard}>
        {[
          ['Vendedor', values.vendedor],
          ['Tipo de café', values.tipoCafe],
          ['Producto', values.producto],
          ['Precio unitario', `$${Number(values.precioUnitario).toFixed(2)}`],
          ['Cantidad', String(values.cantidadVendida)],
          ['Fecha', values.fecha],
        ].map(([key, val]) => (
          <View key={key} style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{key}</Text>
            <Text style={styles.summaryVal}>{val}</Text>
          </View>
        ))}
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalKey}>Monto total</Text>
          <Text style={styles.summaryTotalVal}>${monto.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Pressable style={[styles.btnSecondary, { flex: 1 }]} onPress={onBack} disabled={isSubmitting}>
          <Text style={styles.btnSecondaryText}>← Editar</Text>
        </Pressable>
        <View style={{ width: 12 }} />
        <Pressable
          style={[styles.btnPrimary, { flex: 2 }, isSubmitting && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={isSubmitting}
          testID="btn-submit"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>Registrar venta</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

// ── Componente principal ───────────────────────

export const SalesFormScreen: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { isOnline, isSyncing, pendingCount, addToQueue } = useSyncQueue();

  const handleSubmit = useCallback(
    async (
      values: SaleFormValues,
      helpers: FormikHelpers<SaleFormValues>,
    ) => {
      try {
        const payload: SalePayload = {
          ...(values as Required<SaleFormValues>),
          vendedor: values.vendedor as SalePayload['vendedor'],
          tipoCafe: values.tipoCafe as SalePayload['tipoCafe'],
          precioUnitario: Number(values.precioUnitario),
          cantidadVendida: Number(values.cantidadVendida),
          montoTotal: calcularMontoTotal(values.precioUnitario, values.cantidadVendida),
          id: uuidv4(),
          createdAt: new Date().toISOString(),
        };

        await addToQueue(payload);

        Alert.alert(
          isOnline ? '¡Venta registrada!' : '¡Guardado sin conexión!',
          isOnline
            ? `Venta enviada correctamente. Total: $${payload.montoTotal.toFixed(2)}`
            : `La venta se sincronizará cuando haya conexión. Total: $${payload.montoTotal.toFixed(2)}`,
        );

        helpers.resetForm();
        setStep(1);
      } catch (err) {
        Alert.alert('Error', 'No se pudo guardar la venta. Intenta de nuevo.');
      } finally {
        helpers.setSubmitting(false);
      }
    },
    [addToQueue, isOnline],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Indicador de pasos */}
        <View style={styles.stepsIndicator}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[styles.stepDot, step === s && styles.stepDotActive]}
            />
          ))}
        </View>

        <Formik
          initialValues={initialValues}
          validationSchema={step === 1 ? schemaStep1 : schemaStep2}
          onSubmit={handleSubmit}
          validateOnBlur
          validateOnChange={false}
        >
          {({
            values,
            errors,
            touched,
            setFieldValue,
            setFieldTouched,
            setTouched,
            isSubmitting,
            submitForm,
          }) => {
            // Avanzar al siguiente paso validando solo los campos actuales
            // FIX: e tipado como Yup.ValidationError en lugar de anotación inline
            // FIX: reduce<Record<string,string>> en lugar de anotación en parámetros
            // FIX: validateForm eliminado (no se usaba → advertencia TS)
            const goNext = async () => {
              const schema = step === 1 ? schemaStep1 : schemaStep2;

              const stepErrors = await schema
                .validate(values, { abortEarly: false })
                .then(() => ({} as Record<string, string>))
                .catch((e: Yup.ValidationError) =>
                  e.inner.reduce<Record<string, string>>((acc, cur) => {
                    acc[cur.path ?? ''] = cur.message;
                    return acc;
                  }, {}),
                );

              if (Object.keys(stepErrors).length > 0) {
                setTouched(
                  Object.keys(stepErrors).reduce<Record<string, boolean>>(
                    (acc, k) => ({ ...acc, [k]: true }),
                    {},
                  ),
                );
                return;
              }
              setStep((s) => (s === 1 ? 2 : 3) as 1 | 2 | 3);
            };

            return (
              <>
                {step === 1 && (
                  <Screen1
                    values={values}
                    errors={errors}
                    touched={touched}
                    setFieldValue={setFieldValue}
                    setFieldTouched={setFieldTouched}
                    onNext={goNext}
                  />
                )}
                {step === 2 && (
                  <Screen2
                    values={values}
                    errors={errors}
                    touched={touched}
                    setFieldValue={setFieldValue}
                    setFieldTouched={setFieldTouched}
                    onBack={() => setStep(1)}
                    onNext={goNext}
                  />
                )}
                {step === 3 && (
                  <Screen3
                    values={values}
                    isSubmitting={isSubmitting}
                    isOnline={isOnline}
                    isSyncing={isSyncing}
                    pendingCount={pendingCount}
                    onBack={() => setStep(2)}
                    onSubmit={submitForm}
                  />
                )}
              </>
            );
          }}
        </Formik>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── Estilos ────────────────────────────────────

const BLUE = '#2563EB';
const BLUE_DARK = '#1D4ED8';
const RED = '#DC2626';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20, paddingBottom: 40 },
  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  stepDotActive: { backgroundColor: BLUE, width: 24 },
  screen: { gap: 16 },
  screenTitle: { fontSize: 20, fontWeight: '600', color: '#0F172A', marginBottom: 4 },
  fieldWrapper: { gap: 4 },
  label: { fontSize: 13, fontWeight: '500', color: '#475569' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0F172A',
  },
  inputError: { borderColor: RED },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  errorText: { fontSize: 12, color: RED },
  row: { flexDirection: 'row' },
  btnPrimary: {
    backgroundColor: BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnSecondary: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#475569', fontSize: 15, fontWeight: '500' },
  btnDisabled: { backgroundColor: '#93C5FD' },
  statusBanner: { borderRadius: 8, padding: 10 },
  statusOnline: { backgroundColor: '#DCFCE7' },
  statusOffline: { backgroundColor: '#FEF9C3' },
  statusText: { fontSize: 13, textAlign: 'center' },
  statusTextOnline: { color: '#15803D' },
  statusTextOffline: { color: '#854D0E' },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  summaryKey: { fontSize: 14, color: '#64748B' },
  summaryVal: { fontSize: 14, fontWeight: '500', color: '#0F172A' },
  summaryTotalRow: { borderBottomWidth: 0, paddingTop: 12, marginTop: 4 },
  summaryTotalKey: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  summaryTotalVal: { fontSize: 18, fontWeight: '700', color: BLUE_DARK },
});

export default SalesFormScreen;
