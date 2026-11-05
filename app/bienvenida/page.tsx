import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasCurrentConsent } from '@/lib/consent'
import { createFamily, joinFamily, signOut } from '@/app/actions'
import { ActionForm, SubmitButton } from '@/components/ui'

export default function BienvenidaPage() {
  return (
    <Suspense>
      <Bienvenida />
    </Suspense>
  )
}

async function Bienvenida() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await hasCurrentConsent(supabase, user.id))) redirect('/aceptar')
  const { count } = await supabase.from('family_members').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if (count) redirect('/')
  const name = (user.user_metadata?.full_name as string | undefined) ?? ''

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-8 text-center">
        <div className="text-4xl">👋</div>
        <h1 className="mt-2 text-2xl font-bold">Bienvenida/o{name ? `, ${name}` : ''}</h1>
        <p className="text-slate-500">Crea la familia o únete a una que ya exista.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ActionForm action={createFamily} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">🏠 Crear familia</h2>
          <div>
            <label className="label">Nombre de la familia</label>
            <input name="family" placeholder="Familia Pérez" required className="input" />
          </div>
          <div>
            <label className="label">Tu nombre</label>
            <input name="name" defaultValue={name} required className="input" />
          </div>
          <SubmitButton className="btn w-full">Crear</SubmitButton>
        </ActionForm>
        <ActionForm action={joinFamily} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">🔑 Unirme con código</h2>
          <div>
            <label className="label">Código de la familia</label>
            <input name="code" placeholder="A1B2C3" required className="input uppercase" />
          </div>
          <div>
            <label className="label">Tu nombre</label>
            <input name="name" defaultValue={name} required className="input" />
          </div>
          <SubmitButton className="btn w-full">Unirme</SubmitButton>
        </ActionForm>
      </div>
      <form action={signOut} className="mt-8 text-center">
        <button className="text-sm text-slate-500 underline">Cerrar sesión</button>
      </form>
    </main>
  )
}
