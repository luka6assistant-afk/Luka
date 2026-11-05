import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasCurrentConsent } from '@/lib/consent'
import { joinFamily } from '@/app/actions'
import { ActionForm, SubmitButton } from '@/components/ui'

/** Enlace de invitación: /unirse/A1B2C3 */
export default function UnirsePage(props: PageProps<'/unirse/[code]'>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <Suspense fallback={<p className="text-sm text-slate-500">Cargando invitación…</p>}>
          <Invitation params={props.params} />
        </Suspense>
      </div>
    </main>
  )
}

async function Invitation({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const here = `/unirse/${encodeURIComponent(code)}`
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/registro?next=${encodeURIComponent(here)}`)
  if (!(await hasCurrentConsent(supabase, user.id))) redirect(`/aceptar?next=${encodeURIComponent(here)}`)

  const [{ data: fam }, { count }] = await Promise.all([
    supabase.rpc('family_by_code', { code }).maybeSingle<{ name: string }>(),
    supabase.from('family_members').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  if (!fam)
    return (
      <>
        <div className="text-4xl">🤔</div>
        <h1 className="mt-2 text-lg font-semibold">Invitación no válida</h1>
        <p className="mt-2 text-sm text-slate-600">Pide al administrador de la familia un enlace nuevo.</p>
      </>
    )
  if (count)
    return (
      <>
        <div className="text-4xl">🏠</div>
        <h1 className="mt-2 text-lg font-semibold">Ya perteneces a una familia</h1>
        <p className="mt-2 text-sm text-slate-600">Por ahora cada cuenta puede estar en una sola familia.</p>
        <Link href="/" className="btn mt-4">
          Ir a mi panel
        </Link>
      </>
    )

  return (
    <>
      <div className="text-4xl">👨‍👩‍👧</div>
      <h1 className="mt-2 text-lg font-semibold">Te invitaron a {fam.name}</h1>
      <p className="mt-1 text-sm text-slate-600">Vas a ver y registrar los movimientos de la familia.</p>
      <ActionForm action={joinFamily} className="mt-4 space-y-3 text-left">
        <input type="hidden" name="code" value={code} />
        <div>
          <label className="label">Tu nombre</label>
          <input name="name" defaultValue={(user.user_metadata?.full_name as string | undefined) ?? ''} required className="input" />
        </div>
        <SubmitButton className="btn w-full">Unirme a la familia</SubmitButton>
      </ActionForm>
    </>
  )
}
