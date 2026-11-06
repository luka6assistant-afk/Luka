import { loadAccounts, requireCreator } from '@/lib/creator'

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (rows: (string | number | null)[][]) => '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')
const d = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

/** CSV de cuentas o familias para el creador (Excel en español: ";" y BOM UTF-8). */
export async function GET(request: Request) {
  await requireCreator('/admin/cuentas')
  const tipo = new URL(request.url).searchParams.get('tipo') === 'familias' ? 'familias' : 'cuentas'
  const { accounts, families } = await loadAccounts()

  const body =
    tipo === 'cuentas'
      ? csv([
          ['Nombre', 'Correo', 'Entra por', 'Creada', 'Último ingreso', 'Familias', 'Aceptó términos'],
          ...accounts.map((a) => [
            a.name,
            a.email,
            a.via === 'web' ? 'Correo' : 'Telegram',
            d(a.created_at),
            d(a.last_sign_in_at),
            a.families.map((f) => `${f.name}${f.role === 'admin' ? ' (admin)' : ''}`).join(', '),
            a.consent ?? 'Pendiente',
          ]),
        ])
      : csv([
          ['Familia', 'Creada', 'Plan', 'Estado', 'Vence', 'Telegram', 'Miembros', 'Movimientos 30 días', 'Último movimiento', 'Lecturas IA del mes', 'Administradores'],
          ...families.map((f) => [
            f.name,
            d(f.created_at),
            f.plan,
            f.active ? 'Activo' : 'Vencido',
            d(f.until),
            f.telegram ? 'Sí' : 'No',
            f.members,
            f.tx30,
            d(f.lastTx),
            f.aiThisMonth,
            f.admins.join(', '),
          ]),
        ])

  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="luka-${tipo}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
