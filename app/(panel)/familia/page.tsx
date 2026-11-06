import { requireFamily } from '@/lib/session'
import type { Member } from '@/lib/types'
import { TelegramLinkCode } from '@/components/telegram-link-code'
import { removeMember, renameFamily, setMemberRole, unlinkTelegram } from '@/app/actions'
import { Card } from '@/components/cards'
import { AutoSubmitSelect, ConfirmButton, SubmitButton } from '@/components/ui'
import { CopyButton } from '@/components/copy-button'

export default async function FamiliaPage() {
  const { supabase, family, member, isAdmin } = await requireFamily()
  const { data } = await supabase.from('family_members').select('*').eq('family_id', family.id).order('created_at')
  const members = (data ?? []) as Member[]
  const botUser = process.env.TELEGRAM_BOT_USERNAME
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/unirse/${family.link_code}`
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER
  // El mensaje lleva el código de la familia y el de esta persona, para unir el número a su propio registro
  const waLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hola Luka 👋 Quiero conectar mi WhatsApp. Código: ${family.link_code}·${member.id.slice(0, 8)}`)}`
    : null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="✉️ Invitar a la familia">
        {isAdmin ? (
          <>
            <p className="text-sm text-slate-600">Comparte este enlace por WhatsApp o Telegram. Quien lo abra crea su cuenta y entra a la familia.</p>
            <div className="mt-3 flex gap-2">
              <input readOnly aria-label="Enlace de invitación" value={inviteUrl} className="input font-mono text-xs" />
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
          <div className="space-y-4 text-sm">
            <p className="text-slate-700">
              Desde el celular donde tienes Telegram, toca el botón: Telegram se abre, eliges el grupo de la familia (o creas uno nuevo)
              y Luka queda conectado solo.
            </p>
            {botUser && (
              <a
                href={`https://t.me/${botUser}?startgroup=${family.link_code}`}
                target="_blank"
                rel="noreferrer"
                className="btn w-full py-3 text-base"
              >
                ➕ Conectar con Telegram
              </a>
            )}
            <p className="text-xs text-slate-600">
              ¿No tienes Telegram? Instálalo gratis desde{' '}
              <a href="https://telegram.org/apps" target="_blank" rel="noreferrer" className="underline">
                telegram.org/apps
              </a>{' '}
              y vuelve aquí.{' '}
              <a href="/como-conectar" className="font-medium text-brand-700 underline">
                Ver el video paso a paso
              </a>
            </p>
            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer font-medium text-slate-700">¿No funcionó el botón? Hazlo a mano</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
                <li>Abre el grupo de la familia en Telegram (o créalo).</li>
                <li>
                  Toca el nombre del grupo → <b>Agregar miembros</b> → busca {botUser ? <b>@{botUser}</b> : 'el bot'} y agrégalo.
                </li>
                <li>Escribe en el grupo:</li>
              </ol>
              <div className="mt-2 select-all rounded-xl bg-slate-900 p-3 text-center font-mono text-base tracking-widest text-white">
                /vincular {family.link_code}
              </div>
            </details>
          </div>
        ) : (
          <p className="text-sm text-slate-600">El administrador aún no ha conectado el chat de Telegram.</p>
        )}
      </Card>

      <Card title="🏠 Familia" className="lg:col-span-2">
        {isAdmin && (
          <form action={renameFamily} className="mb-6 flex max-w-md gap-2">
            <input name="name" aria-label="Nombre de la familia" defaultValue={family.name} className="input" />
            <SubmitButton>Guardar</SubmitButton>
          </form>
        )}
        <h3 className="mb-2 text-sm font-medium text-slate-600">Miembros</h3>
        <ul className="divide-y divide-slate-100 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {m.display_name}
                {m.id === member.id && <span className="text-slate-500"> (tú)</span>}
                <span className="ml-2 text-xs text-slate-500">
                  {m.user_id ? '🌐 web' : ''} {m.telegram_user_id ? '✈️ Telegram' : ''} {m.whatsapp_phone ? '💬 WhatsApp' : ''}
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {isAdmin ? (
                  <>
                    <form action={setMemberRole}>
                      <input type="hidden" name="id" value={m.id} />
                      <AutoSubmitSelect key={`r-${m.role}`} name="role" aria-label={`Rol de ${m.display_name}`} defaultValue={m.role} className="input py-1 text-xs">
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
          reportes. Quien escribe en el grupo de Telegram o conecta su WhatsApp con el código queda registrado como miembro.
        </p>
      </Card>

      {waLink && (
        <Card title="💬 WhatsApp">
          {member.whatsapp_phone ? (
            <p className="text-sm text-brand-700">🟢 Tu WhatsApp está conectado. Envíale a Luka fotos de recibos, PDF, notas de voz o escribe el gasto.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-slate-700">
                Habla con Luka por WhatsApp, cada quien desde su celular. Toca el botón, se abre el chat con el mensaje listo y solo tienes
                que enviarlo.
              </p>
              <a href={waLink} target="_blank" rel="noreferrer" className="btn w-full py-3 text-base">
                💬 Conectar WhatsApp
              </a>
              <p className="text-xs text-slate-600">Cada miembro de la familia conecta su propio WhatsApp desde su cuenta.</p>
            </div>
          )}
        </Card>
      )}

      {!member.telegram_user_id && (
        <Card title="✈️ Conectar mi Telegram (Soy yo)">
          <TelegramLinkCode />
        </Card>
      )}
    </div>
  )
}
