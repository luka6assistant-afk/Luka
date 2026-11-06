import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeAccess, FOUNDER, PLANS } from './plans'
import { money } from './format'
import { founderSlots } from './growth'
import type { Family } from './types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
const DAY = 86_400_000

type Step = {
  id: string
  /** ¿Ya es momento de este paso? */
  due: (ctx: Ctx) => boolean
  /** Mensaje si hace falta, o null si la familia ya lo hizo (el paso se marca sin enviar nada). */
  message: (ctx: Ctx) => Promise<string | null>
}
type Ctx = { db: SupabaseClient; fam: Family & { created_at: string }; ageDays: number; daysLeft: number }

const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0

/**
 * Mensajes al grupo durante la prueba gratis. Cada uno se envía una sola vez y solo si hace falta
 * (por ejemplo, no se pide "envíen su primer recibo" a quien ya lo hizo). Máximo un mensaje al día.
 */
const STEPS: Step[] = [
  {
    id: 'd1',
    due: (c) => c.ageDays >= 1,
    message: async ({ db, fam }) =>
      (await count(db.from('transactions').select('id', { count: 'exact', head: true }).eq('family_id', fam.id)))
        ? null
        : '👋 ¿Ya probaron Luka? Envíen a este grupo la foto de un recibo o escriban, por ejemplo, «mercado 85.000 en el D1». También sirven PDF y notas de voz.',
  },
  {
    id: 'd3',
    due: (c) => c.ageDays >= 3,
    message: async ({ db, fam }) =>
      (await count(
        db.from('family_members').select('id', { count: 'exact', head: true }).eq('family_id', fam.id).not('telegram_user_id', 'is', null),
      )) >= 2
        ? null
        : '👫 Luka funciona mejor entre todos: agreguen a este grupo a su pareja o a quien también maneje plata en la casa. Cada quien registra sus gastos y todos ven el mismo resumen.',
  },
  {
    id: 'd10',
    due: (c) => c.ageDays >= 10,
    message: async ({ db, fam }) =>
      (await count(db.from('savings_goals').select('id', { count: 'exact', head: true }).eq('family_id', fam.id).eq('active', true)))
        ? null
        : `🐷 ¿Para qué están ahorrando? Creen su primera meta (vacaciones, fondo de emergencia, el regalo de Navidad…) en el panel: ${APP_URL}/ahorros. Les digo cuánto apartar cada mes para llegar a tiempo.`,
  },
  {
    id: 'end',
    due: (c) => c.daysLeft <= 6 && c.daysLeft > 3,
    message: async ({ db, fam, ageDays, daysLeft }) => {
      const { data } = await db.from('transactions').select('kind, amount').eq('family_id', fam.id).eq('status', 'confirmed')
      const rows = data ?? []
      const spent = rows.filter((r) => r.kind === 'expense').reduce((s, r) => s + Number(r.amount), 0)
      const slots = await founderSlots()
      return [
        rows.length
          ? `📊 En sus primeros ${ageDays} días con Luka registraron ${rows.length} movimientos (gastos por ${money(spent)}).`
          : `📊 Llevan ${ageDays} días con Luka.`,
        `La prueba gratis termina en ${daysLeft} días. Para que sigamos leyendo sus recibos, elijan un plan: ${APP_URL}/plan`,
        slots.remaining > 0
          ? `🌱 Precio de fundador: ${PLANS[FOUNDER.plan].name} a ${money(FOUNDER.monthlyPrice)} al mes, para siempre. Quedan ${slots.remaining} de ${FOUNDER.limit} cupos.`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    },
  },
]

/** Revisa la familia y devuelve el mensaje del día (o null). Marca los pasos vistos en families.onboarding_sent. */
export async function onboardingMessage(db: SupabaseClient, fam: Family & { created_at: string }): Promise<string | null> {
  if (fam.plan !== 'trial') return null
  const a = computeAccess(fam, 0)
  if (!a.active) return null
  const ctx: Ctx = { db, fam, ageDays: Math.floor((Date.now() - new Date(fam.created_at).getTime()) / DAY), daysLeft: a.daysLeft }
  const sent = new Set(fam.onboarding_sent ?? [])
  let text: string | null = null
  for (const step of STEPS) {
    if (sent.has(step.id) || !step.due(ctx)) continue
    sent.add(step.id)
    text = await step.message(ctx)
    if (text) break // un mensaje al día como máximo
  }
  const marked = [...sent]
  if (marked.length !== (fam.onboarding_sent ?? []).length) await db.from('families').update({ onboarding_sent: marked }).eq('id', fam.id)
  return text
}
