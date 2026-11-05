/**
 * Interruptores de funcionalidades.
 * Deudas (saldos, intereses, avalancha / bola de nieve) quedan fuera del MVP según el PRD:
 * el código se conserva, pero está oculto. En el MVP un abono se registra como gasto en la categoría "Deudas".
 * Para activarlo: NEXT_PUBLIC_FEATURE_DEBTS=true
 */
export const FEATURES = {
  debts: process.env.NEXT_PUBLIC_FEATURE_DEBTS === 'true',
} as const
