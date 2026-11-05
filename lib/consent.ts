import 'server-only'
import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LEGAL, type LegalDoc } from './legal'
import { createAdminClient } from './supabase/server'

const DOCS = Object.keys(LEGAL.versions) as LegalDoc[]

/** ¿El usuario aceptó la versión vigente de todos los documentos? */
export async function hasCurrentConsent(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from('legal_consents').select('document, version').eq('user_id', userId)
  return DOCS.every((doc) => data?.some((c) => c.document === doc && c.version === LEGAL.versions[doc]))
}

/**
 * Guarda la prueba de la aceptación (fecha, versión, IP y navegador).
 * Usa el cliente admin porque al registrarse puede no haber sesión todavía (confirmación por correo).
 */
export async function recordConsent(userId: string) {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
  const userAgent = h.get('user-agent')?.slice(0, 300) ?? null
  const rows = DOCS.map((document) => ({
    user_id: userId,
    document,
    version: LEGAL.versions[document],
    ip,
    user_agent: userAgent,
  }))
  const { error } = await createAdminClient()
    .from('legal_consents')
    .upsert(rows, { onConflict: 'user_id,document,version', ignoreDuplicates: true })
  if (error) throw new Error(`No se pudo guardar la aceptación: ${error.message}`)
}
