import type { SupabaseClient } from '@supabase/supabase-js'
import type { Family } from './types'
import { monthStart } from './format'

export type PlanId = 'trial' | 'familia' | 'plus'
export type PaidPlanId = Exclude<PlanId, 'trial'>
export type Period = 'monthly' | 'yearly'

export interface PlanInfo {
  id: PlanId
  name: string
  monthlyPrice: number // COP
  yearlyPrice: number // COP (2 meses gratis)
  aiLimit: number // lecturas con IA al mes
  /** Módulo de deudas (además requiere FEATURES.debts, apagado en el MVP) */
  debts: boolean
  features: string[]
}

export const PLANS: Record<PlanId, PlanInfo> = {
  trial: {
    id: 'trial',
    name: 'Prueba gratis',
    monthlyPrice: 0,
    yearlyPrice: 0,
    aiLimit: 100,
    debts: true,
    features: ['30 días con todo incluido', 'Hasta 100 lecturas con IA al mes'],
  },
  familia: {
    id: 'familia',
    name: 'Familia',
    monthlyPrice: 14_900,
    yearlyPrice: 149_000,
    aiLimit: 100,
    debts: false,
    features: ['100 lecturas con IA al mes: fotos, PDF, mensajes y notas de voz', 'Panel web y resumen en el chat', 'Presupuesto por categoría con alertas', 'Metas de ahorro'],
  },
  plus: {
    id: 'plus',
    name: 'Familia Plus',
    monthlyPrice: 24_900,
    yearlyPrice: 249_000,
    aiLimit: 1_000,
    debts: true,
    features: ['Todo lo del plan Familia', '1.000 lecturas con IA al mes, ideal para familias grandes'],
  },
}

/** Días de prueba gratis al crear una familia (debe coincidir con supabase/006_crecimiento.sql). */
export const TRIAL_DAYS = 30

/**
 * Precio de fundador: las primeras familias que paguen el plan Familia lo conservan para siempre,
 * aunque los precios suban. Se marca al aprobarse su primer pago con este precio.
 */
export const FOUNDER = {
  limit: 20,
  plan: 'familia' as PaidPlanId,
  monthlyPrice: 9_900,
  yearlyPrice: 99_000,
}

/** Días gratis para cada familia cuando una familia invitada paga su primer plan. */
export const REFERRAL_DAYS = 30

export function priceFor(plan: PaidPlanId, period: Period, founder = false): number {
  if (founder && plan === FOUNDER.plan) return period === 'yearly' ? FOUNDER.yearlyPrice : FOUNDER.monthlyPrice
  return period === 'yearly' ? PLANS[plan].yearlyPrice : PLANS[plan].monthlyPrice
}

export interface Access {
  plan: PlanInfo
  active: boolean
  /** Fecha hasta la que tiene acceso (fin de prueba o del periodo pagado). */
  until: Date
  daysLeft: number
  used: number
  remaining: number
}

export async function getAccess(db: SupabaseClient, family: Family): Promise<Access> {
  const { data } = await db
    .from('ai_usage')
    .select('count')
    .eq('family_id', family.id)
    .eq('month', monthStart(0))
    .maybeSingle()
  return computeAccess(family, data?.count ?? 0)
}

export function computeAccess(family: Family, used: number): Access {
  const plan = PLANS[(family.plan as PlanId) ?? 'trial'] ?? PLANS.trial
  const until = new Date(plan.id === 'trial' ? family.trial_ends_at : (family.paid_until ?? family.trial_ends_at))
  const ms = until.getTime() - Date.now()
  return {
    plan,
    active: ms > 0,
    until,
    daysLeft: Math.max(0, Math.ceil(ms / 86_400_000)),
    used,
    remaining: Math.max(0, plan.aiLimit - used),
  }
}
