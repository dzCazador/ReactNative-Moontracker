/**
 * Utilidades compartidas de la capa de datos.
 * Todas las funciones son puras y funcionan 100% offline.
 */

export function nowISO(): string {
  return new Date().toISOString();
}

export function generateId(): string {
  // crypto.randomUUID está disponible en React Native (expo-polyfills), navegadores y Node (jest).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback determinista para entornos sin crypto (nunca debería ocurrir en el stack actual).
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
