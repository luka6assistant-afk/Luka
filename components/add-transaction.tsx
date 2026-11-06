'use client'

import { useState } from 'react'
import { addTransaction } from '@/app/actions'
import { FEATURES } from '@/lib/features'
import { ActionForm, SubmitButton } from './ui'
import type { Category, Debt, Member, SavingsGoal, TxKind } from '@/lib/types'

export function AddTransaction({
  categories,
  debts,
  goals,
  members,
  today,
}: {
  categories: Category[]
  debts: Debt[]
  goals: SavingsGoal[]
  members: Member[]
  today: string
}) {
  const [kind, setKind] = useState<TxKind>('expense')
  return (
    <ActionForm action={addTransaction} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="label">Tipo</label>
        <select aria-label="Tipo" name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as TxKind)}>
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
          {FEATURES.debts && <option value="debt_payment">Abono a deuda</option>}
          <option value="saving">Ahorro</option>
        </select>
      </div>
      <div>
        <label className="label">Monto (COP)</label>
        <input aria-label="Monto (COP)" name="amount" inputMode="decimal" placeholder="45.900" required className="input" />
      </div>
      <div>
        <label className="label">Fecha</label>
        <input aria-label="Fecha" name="occurred_on" type="date" defaultValue={today} className="input" />
      </div>
      {(kind === 'expense' || kind === 'income') && (
        <div>
          <label className="label">Categoría</label>
          <select aria-label="Categoría" name="category_id" className="input">
            <option value="">Sin categoría</option>
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
          </select>
        </div>
      )}
      {kind === 'debt_payment' && (
        <div>
          <label className="label">Deuda</label>
          <select aria-label="Deuda" name="debt_id" required className="input">
            {debts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {kind === 'saving' && (
        <div>
          <label className="label">Meta</label>
          <select aria-label="Meta" name="savings_goal_id" required className="input">
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label">Comercio / persona</label>
        <input aria-label="Comercio / persona" name="merchant" className="input" />
      </div>
      <div>
        <label className="label">Descripción</label>
        <input aria-label="Descripción" name="description" className="input" />
      </div>
      <div>
        <label className="label">Medio de pago</label>
        <input aria-label="Medio de pago" name="payment_method" list="medios" className="input" />
        <datalist id="medios">
          {['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta débito', 'Tarjeta crédito', 'Transferencia', 'PSE'].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="label">Quién</label>
        <select aria-label="Quién" name="member_id" className="input">
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <SubmitButton className="btn w-full">Agregar</SubmitButton>
      </div>
    </ActionForm>
  )
}
