import 'server-only'
import { createAdminClient } from './supabase/server'
import { FOUNDER, REFERRAL_DAYS } from './plans'
import type { Family } from './types'

/** Cupos de fundador: cuántas familias ya lo son y cuántos quedan. */
export async function founderSlots() {
  const { count } = await createAdminClient().from('families').select('id', { count: 'exact', head: true }).eq('founder', true)
  const taken = count ?? 0
  return { taken, remaining: Math.max(0, FOUNDER.limit - taken) }
}

/** ¿Esta familia paga con precio de fundador? Si ya lo es, siempre; si no, mientras queden cupos. */
export async function founderPriceApplies(family: Family) {
  if (family.founder) return true
  return (await founderSlots()).remaining > 0
}

export const referralUrl = (family: Pick<Family, 'referral_code'>) =>
  `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/r/${family.referral_code ?? ''}`

/** Busca la familia dueña de un código de invitación. */
export async function familyByReferralCode(code: string) {
  const clean = code.trim().toUpperCase()
  if (!/^[A-Z0-9]{5,10}$/.test(clean)) return null
  const { data } = await createAdminClient().from('families').select('id, name').eq('referral_code', clean).maybeSingle()
  return data as { id: string; name: string } | null
}

/** Familias que invitó esta familia y cuántas ya pagaron (recompensa entregada). */
export async function referralStats(familyId: string) {
  const { data } = await createAdminClient()
    .from('families')
    .select('id, referral_rewarded_at')
    .eq('referred_by', familyId)
  const rows = data ?? []
  return { invited: rows.length, rewarded: rows.filter((r) => r.referral_rewarded_at).length }
}

/** Avisa por Telegram a las dos familias cuando se entrega la recompensa de un referido. */
export async function notifyReferralReward(reference: string) {
  const db = createAdminClient()
  const { data: p } = await db.from('payments').select('family_id').eq('reference', reference).maybeSingle()
  if (!p?.family_id) return
  const { data: invited } = await db.from('families').select('id, name, telegram_chat_id, referred_by').eq('id', p.family_id).maybeSingle()
  if (!invited?.referred_by) return
  const { data: inviter } = await db.from('families').select('name, telegram_chat_id').eq('id', invited.referred_by).maybeSingle()
  const { bot, ensureBotReady } = await import('./bot')
  await ensureBotReady()
  const send = (chat: number | null | undefined, text: string) =>
    chat ? bot.api.sendMessage(chat, text).catch((e) => console.error('Aviso de referido', e)) : null
  await Promise.all([
    send(invited.telegram_chat_id, `🎁 Como llegaron invitados, les sumamos ${REFERRAL_DAYS} días gratis a su plan. ¡Bienvenidos a Luka!`),
    send(inviter?.telegram_chat_id, `🎁 ${invited.name} se unió a Luka con su invitación y pagó su primer plan. Les sumamos ${REFERRAL_DAYS} días gratis. ¡Gracias por recomendarnos!`),
  ])
}
