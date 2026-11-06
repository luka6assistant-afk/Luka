/**
 * De dónde llega cada visitante: campaña (?utm_source / ?src), invitación (?ref) o el sitio que enlazó (referrer).
 * No usa cookies ni guarda nada en el navegador: la fuente viaja en el enlace hasta el registro.
 */

export const SOURCE_LABEL: Record<string, string> = {
  tiktok: '🎵 TikTok',
  instagram: '📸 Instagram',
  facebook: '👥 Facebook',
  whatsapp: '💬 WhatsApp',
  telegram: '✈️ Telegram',
  google: '🔎 Google',
  youtube: '▶️ YouTube',
  linkedin: '💼 LinkedIn',
  x: '𝕏 X / Twitter',
  referido: '🎁 Invitación de otra familia',
  directo: '🔗 Directo (escribió la dirección o sin datos)',
  otro: '🌐 Otro sitio',
}

const clean = (v: string | null | undefined) =>
  (v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

const ALIASES: Record<string, string> = { ig: 'instagram', fb: 'facebook', meta: 'facebook', wa: 'whatsapp', tt: 'tiktok', twitter: 'x', yt: 'youtube' }

/** Nombre de fuente normalizado (ej. "IG" → "instagram"). */
export function normalizeSource(v: string | null | undefined): string {
  const s = clean(v)
  return ALIASES[s] ?? s
}

/** Reconoce la red o buscador a partir del sitio que envió la visita. */
export function sourceFromReferrer(referrer: string, ownHost: string): string {
  if (!referrer) return 'directo'
  let host = ''
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '')
  } catch {
    return 'otro'
  }
  if (!host || host === ownHost) return 'directo'
  if (/tiktok/.test(host)) return 'tiktok'
  if (/instagram/.test(host)) return 'instagram'
  if (/facebook|fb\.|messenger/.test(host)) return 'facebook'
  if (/whatsapp|wa\.me/.test(host)) return 'whatsapp'
  if (/t\.me|telegram/.test(host)) return 'telegram'
  if (/google\./.test(host)) return 'google'
  if (/youtube|youtu\.be/.test(host)) return 'youtube'
  if (/linkedin|lnkd/.test(host)) return 'linkedin'
  if (/(^|\.)x\.com$|twitter|t\.co$/.test(host)) return 'x'
  return 'otro'
}

export interface Acquisition {
  source: string
  campaign: string | null
}

/** Fuente de una visita a partir de los parámetros del enlace y el referrer. */
export function detectAcquisition(search: URLSearchParams, referrer: string, ownHost: string): Acquisition {
  const utm = normalizeSource(search.get('utm_source') ?? search.get('src'))
  const campaign = clean(search.get('utm_campaign') ?? search.get('cmp')) || null
  if (utm) return { source: utm, campaign }
  if (search.get('ref')) return { source: 'referido', campaign }
  return { source: sourceFromReferrer(referrer, ownHost), campaign }
}
