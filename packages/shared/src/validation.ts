export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InputError('Se esperaba un objeto válido.');
  return value as Record<string, unknown>;
}
export function segment(value: unknown, label = 'Identificador') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw new InputError(`${label} no válido.`);
  return value;
}
export function operationId(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new InputError('Identificador de operación no válido.');
  return value;
}
export function amount(value: unknown, allowZero = false) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > 100_000_000
  )
    throw new InputError('El monto debe expresarse en centavos enteros válidos.');
  return value;
}
