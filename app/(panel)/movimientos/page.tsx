import Link from 'next/link'
import { requireFamily } from '@/lib/session'
import { shiftMonth } from '@/lib/finance'
import { monthChoices, dateLabel, money, monthLabel, monthStart, todayISO } from '@/lib/format'
import { KIND_LABEL, type Category, type Debt, type Member, type SavingsGoal, type Transaction } from '@/lib/types'
import { deleteTransaction, updateTransaction } from '@/app/actions'
import { Card, Empty } from '@/components/cards'
import { AutoSubmitSelect, ConfirmButton } from '@/components/ui'
import { AddTransaction } from '@/components/add-transaction'
import { FEATURES } from '@/lib/features'

export default async function MovimientosPage(props: PageProps<'/movimientos'>) {
  const sp = await props.searchParams
  const month = typeof sp.mes === 'string' && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : monthStart(0)
  const estado = sp.estado === 'pending' ? 'pending' : undefined
  const tipo = typeof sp.tipo === 'string' && sp.tipo in KIND_LABEL ? sp.tipo : undefined
  const cat = typeof sp.cat === 'string' && (sp.cat === 'none' || /^[0-9a-f-]{36}$/i.test(sp.cat)) ? sp.cat : undefined
  const quien = typeof sp.quien === 'string' && /^[0-9a-f-]{36}$/i.test(sp.quien) ? sp.quien : undefined

  const { supabase, family } = await requireFamily()
  let q = supabase
    .from('transactions')
    .select('*')
    .eq('family_id', family.id)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (estado) q = q.eq('status', 'pending')
  else q = q.gte('occurred_on', month).lt('occurred_on', shiftMonth(month, 1))
  if (tipo) q = q.eq('kind', tipo)
  if (cat === 'none') q = q.is('category_id', null)
  else if (cat) q = q.eq('category_id', cat)
  if (quien) q = q.eq('member_id', quien)

  const [{ data: txData }, { data: cats }, { data: debts }, { data: goals }, { data: members }] = await Promise.all([
    q.limit(500),
    supabase.from('categories').select('*').eq('family_id', family.id).order('name'),
    supabase.from('debts').select('*').eq('family_id', family.id).eq('active', true).order('name'),
    supabase.from('savings_goals').select('*').eq('family_id', family.id).eq('active', true).order('name'),
    supabase.from('family_members').select('*').eq('family_id', family.id).order('display_name'),
  ])
  const txs = (txData ?? []) as Transaction[]
  const categories = (cats ?? []) as Category[]

  // Enlaces firmados (1 hora) para ver las fotos de los recibos
  const paths = txs.map((t) => t.receipt_path).filter((p): p is string => !!p)
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data } = await supabase.storage.from('recibos').createSignedUrls(paths, 3600)
    data?.forEach((d) => d.path && d.signedUrl && signed.set(d.path, d.signedUrl))
  }

  const total = (k: string) => txs.filter((t) => t.kind === k && t.status === 'confirmed').reduce((s, t) => s + Number(t.amount), 0)
  const ym = month.slice(0, 7)
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { mes: ym, tipo, cat, quien, ...patch }
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v))
    return `/movimientos?${p}`
  }

  return (
    <div className="space-y-4">
      <Card title="Agregar movimiento manual">
        <AddTransaction
          categories={categories}
          debts={(debts ?? []) as Debt[]}
          goals={(goals ?? []) as SavingsGoal[]}
          members={(members ?? []) as Member[]}
          today={todayISO()}
        />
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {estado ? (
            <span className="font-semibold">🕓 Pendientes por confirmar</span>
          ) : (
            <>
              <Link className="btn-ghost" href={link({ mes: shiftMonth(month, -1).slice(0, 7) })}>
                ←
              </Link>
              <span className="min-w-24 text-center font-semibold capitalize">{monthLabel(month)}</span>
              <Link className="btn-ghost" href={link({ mes: shiftMonth(month, 1).slice(0, 7) })}>
                →
              </Link>
            </>
          )}
          <div className="ml-auto flex flex-wrap gap-1">
            {[undefined, 'expense', 'income', ...(FEATURES.debts ? ['debt_payment'] : []), 'saving'].map((k) => (
              <Link
                key={k ?? 'all'}
                href={estado ? `/movimientos?estado=pending${k ? `&tipo=${k}` : ''}` : link({ tipo: k, cat: undefined })}
                className={`rounded-lg px-2.5 py-1 text-sm ${tipo === k ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {k ? KIND_LABEL[k as keyof typeof KIND_LABEL] : 'Todos'}
              </Link>
            ))}
            <Link
              href={estado ? '/movimientos' : '/movimientos?estado=pending'}
              className={`rounded-lg px-2.5 py-1 text-sm ${estado ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Pendientes
            </Link>
          </div>
        </div>

        {!estado && (
          <form className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="mes" value={ym} />
            {tipo && <input type="hidden" name="tipo" value={tipo} />}
            <div>
              <label className="label">Categoría</label>
              <AutoSubmitSelect aria-label="Categoría" name="cat" defaultValue={cat ?? ''} className="input py-1">
                <option value="">Todas</option>
                <option value="none">Sin categoría</option>
                {categories
                  .filter((c) => !tipo || c.kind === tipo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </AutoSubmitSelect>
            </div>
            <div>
              <label className="label">Quién</label>
              <AutoSubmitSelect aria-label="Quién" name="quien" defaultValue={quien ?? ''} className="input py-1">
                <option value="">Todos</option>
                {(members ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </AutoSubmitSelect>
            </div>
            {(cat || quien) && (
              <Link href={link({ cat: undefined, quien: undefined })} className="btn-ghost">
                Quitar filtros
              </Link>
            )}
          </form>
        )}

        {!estado && (
          <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-600">
            <span>Ingresos: <b className="text-brand-700">{money(total('income'))}</b></span>
            <span>Gastos: <b>{money(total('expense'))}</b></span>
            {FEATURES.debts && <span>Abonos: <b>{money(total('debt_payment'))}</b></span>}
            <span>Ahorro: <b>{money(total('saving'))}</b></span>
          </div>
        )}

        {txs.length === 0 ? (
          <Empty>No hay movimientos aquí.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Fecha</th>
                  <th>Detalle</th>
                  <th>Categoría / destino</th>
                  <th>Quién</th>
                  <th className="text-right">Monto</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txs.map((t) => (
                  <tr key={t.id} className={t.status === 'pending' ? 'bg-sky-50/50' : ''}>
                    <td className="py-2 whitespace-nowrap text-slate-600">{dateLabel(t.occurred_on)}</td>
                    <td className="max-w-64">
                      <p className="truncate font-medium">{t.merchant || t.description || KIND_LABEL[t.kind]}</p>
                      <p className="truncate text-xs text-slate-500">
                        {KIND_LABEL[t.kind]}
                        {t.merchant && t.description ? ` · ${t.description}` : ''}
                        {t.payment_method ? ` · ${t.payment_method}` : ''}
                        {t.source.startsWith('telegram') ? ' · Telegram' : t.source.startsWith('whatsapp') ? ' · WhatsApp' : ''}
                      </p>
                    </td>
                    <td>
                      <form action={updateTransaction}>
                        <input type="hidden" name="id" value={t.id} />
                        {t.kind === 'expense' || t.kind === 'income' ? (
                          <AutoSubmitSelect key={`c-${t.category_id}`} name="category_id" aria-label="Categoría" defaultValue={t.category_id ?? ''} className="input py-1">
                            <option value="">Sin categoría</option>
                            {categories
                              .filter((c) => c.kind === t.kind)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon} {c.name}
                                </option>
                              ))}
                          </AutoSubmitSelect>
                        ) : t.kind === 'debt_payment' ? (
                          <AutoSubmitSelect key={`d-${t.debt_id}`} name="debt_id" aria-label="Deuda" defaultValue={t.debt_id ?? ''} className="input py-1">
                            <option value="">— Elegir deuda —</option>
                            {(debts ?? []).map((d) => (
                              <option key={d.id} value={d.id}>
                                💳 {d.name}
                              </option>
                            ))}
                          </AutoSubmitSelect>
                        ) : null}
                        {t.kind === 'debt_payment' ? (
                          <AutoSubmitSelect
                            key={`m-${t.applies_to_month}`}
                            name="applies_to_month"
                            aria-label="Cuota del mes"
                            defaultValue={t.applies_to_month ?? t.occurred_on.slice(0, 8) + '01'}
                            className="input mt-1 py-1 text-xs capitalize"
                          >
                            {monthChoices(t.occurred_on).map((o) => (
                              <option key={o.value} value={o.value}>
                                Cuota de {o.label}
                              </option>
                            ))}
                          </AutoSubmitSelect>
                        ) : t.kind === 'saving' ? (
                          <AutoSubmitSelect key={`g-${t.savings_goal_id}`} name="savings_goal_id" aria-label="Meta de ahorro" defaultValue={t.savings_goal_id ?? ''} className="input py-1">
                            <option value="">— Elegir meta —</option>
                            {(goals ?? []).map((g) => (
                              <option key={g.id} value={g.id}>
                                🐷 {g.name}
                              </option>
                            ))}
                          </AutoSubmitSelect>
                        ) : null}
                      </form>
                    </td>
                    <td className="text-slate-600">{members?.find((m) => m.id === t.member_id)?.display_name ?? '—'}</td>
                    <td className={`text-right font-medium tabular-nums ${t.kind === 'income' ? 'text-brand-700' : ''}`}>
                      {t.kind === 'income' ? '+' : '−'}
                      {money(t.amount)}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {t.receipt_path && signed.get(t.receipt_path) && (
                        <a href={signed.get(t.receipt_path)} target="_blank" rel="noreferrer" className="btn-danger text-slate-600" title="Ver recibo">
                          📎
                        </a>
                      )}
                      {t.status === 'pending' && (
                        <form action={updateTransaction} className="inline">
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value="confirmed" />
                          <button className="btn-danger text-brand-700" title="Confirmar">
                            ✅
                          </button>
                        </form>
                      )}
                      <form action={deleteTransaction} className="inline">
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmButton message="¿Borrar este movimiento?">🗑</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
