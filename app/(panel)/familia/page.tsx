import { requireFamily } from '@/lib/session'
import type { Member } from '@/lib/types'
import { linkMemberToMe, removeMember, renameFamily, setMemberRole, unlinkTelegram } from '@/app/actions'
import { Card } from '@/components/cards'
import { AutoSubmitSelect, ConfirmButton, SubmitButton } from '@/components/ui'
import { CopyButton } from '@/components/copy-button'

export default async function FamiliaPage() {
  const { supabase, family, member, isAdmin } = await requireFamily()
  const { data } = await supabase.from('family_members').select('*').eq('family_id', family.id).order('created_at')
  const members = (data ?? []) as Member[]
  const botUser = process.env.TELEGRAM_BOT_USERNAME
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/unirse/${family.link_code}`

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="✉️ Invitar a la familia">
        {isAdmin ? (
          <>
            <p className="text-sm text-slate-600">Comparte este enlace por WhatsApp o Telegram. Quien lo abra crea su cuenta y entra a la familia.</p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={inviteUrl} className="input font-mono text-xs" />
              <CopyButton value={inviteUrl} />
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Únete a nuestras finanzas familiares: ${inviteUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost mt-3"
            >
              Enviar por WhatsApp
            </a>
          </>
        ) : (
          <p className="text-sm text-slate-600">Pide al administrador de la familia el enlace de invitación.</p>
        )}
      </Card>

      <Card title="📲 Conectar Telegram">
        {family.telegram_chat_id ? (
          <div className="space-y-3 text-sm">
            <p className="text-brand-700">🟢 El chat familiar está conectado.</p>
            <p className="text-slate-600">Envíen fotos de recibos, PDF, mensajes o notas de voz al grupo y el bot los registra.</p>
            {isAdmin && (
              <form action={unlinkTelegram}>
                <ConfirmButton message="¿Desvincular el chat de Telegram?">Desvincular chat</ConfirmButton>
              </form>
            )}
          </div>
        ) : isAdmin ? (
          <>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Agreguen el bot {botUser ? <b>@{botUser}</b> : 'de la familia'} al grupo de Telegram de la familia.</li>
              <li>En el grupo escriban:</li>
            </ol>
            <div className="mt-3 rounded-xl bg-slate-900 p-4 text-center font-mono text-lg tracking-widest text-white">
              /vincular {family.link_code}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">El administrador aún no ha conectado el chat de Telegram.</p>
        )}
      </Card>

      <Card title="🏠 Familia" className="lg:col-span-2">
        {isAdmin && (
          <form action={renameFamily} className="mb-6 flex max-w-md gap-2">
            <input name="name" defaultValue={family.name} className="input" />
            <SubmitButton>Guardar</SubmitButton>
          </form>
        )}
        <h3 className="mb-2 text-sm font-medium text-slate-600">Miembros</h3>
        <ul className="divide-y divide-slate-100 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {m.display_name}
                {m.id === member.id && <span className="text-slate-400"> (tú)</span>}
                <span className="ml-2 text-xs text-slate-500">
                  {m.user_id ? '🌐 web' : ''} {m.telegram_user_id ? '✈️ Telegram' : ''}
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {!m.user_id && !member.telegram_user_id && (
                  <form action={linkMemberToMe}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <ConfirmButton message={`¿${m.display_name} en Telegram eres tú? Se unirán sus movimientos a tu cuenta.`} className="btn-ghost text-xs">
                      Soy yo
                    </ConfirmButton>
                  </form>
                )}
                {isAdmin ? (
                  <>
                    <form action={setMemberRole}>
                      <input type="hidden" name="id" value={m.id} />
                      <AutoSubmitSelect name="role" defaultValue={m.role} className="input py-1 text-xs">
                        <option value="admin">Administrador</option>
                        <option value="member">Miembro</option>
                      </AutoSubmitSelect>
                    </form>
                    {m.id !== member.id && (
                      <form action={removeMember}>
                        <input type="hidden" name="id" value={m.id} />
                        <ConfirmButton message={`¿Sacar a ${m.display_name} de la familia? Sus movimientos se conservan.`} title="Sacar de la familia">
                          🗑
                        </ConfirmButton>
                      </form>
                    )}
                  </>
                ) : (
                  <span className="rounded bg-slate-100 px-1.5">{m.role === 'admin' ? 'Administrador' : 'Miembro'}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Administrador: gestiona la familia, categorías, presupuestos y metas. Miembro: registra movimientos y aportes, y consulta
          reportes. Quien escribe en el grupo de Telegram queda registrado como miembro; con “Soy yo” unes tu usuario de Telegram a tu
          cuenta web.
        </p>
      </Card>
    </div>
  )
}
