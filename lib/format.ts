const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/** $1.234.567 */
export function money(value: number | string | null | undefined): string {
  return cop.format(Number(value ?? 0))
}

const TZ = 'America/Bogota'

/** Fecha de hoy en Colombia como YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

/** Primer día del mes (YYYY-MM-01) desplazado `offset` meses desde hoy. */
export function monthStart(offset = 0): string {
  const [y, m] = todayISO().split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + offset, 1))
  return d.toISOString().slice(0, 10)
}

export function daysInMonth(isoDate: string): number {
  const [y, m] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function monthLabel(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  )
}

export function dateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

/** Interpreta montos escritos a la colombiana: "25.000", "25mil", "1,5M", "$ 120.500,50". */
export function parseCOP(input: string): number | null {
  let s = input.toLowerCase().replace(/\s|\$|cop/g, '')
  let mult = 1
  if (/(millones|millón|millon|m)$/.test(s)) {
    mult = 1_000_000
    s = s.replace(/(millones|millón|millon|m)$/, '')
  } else if (/(mil|k)$/.test(s)) {
    mult = 1_000
    s = s.replace(/(mil|k)$/, '')
  }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * mult * 100) / 100 : null
}

/** Meses alrededor de una fecha (anterior, el mismo y el siguiente) para elegir a qué cuota corresponde un abono. */
export function monthChoices(isoDate: string): { value: string; label: string }[] {
  const [y, m] = isoDate.split('-').map(Number)
  return [-1, 0, 1].map((d) => {
    const dt = new Date(Date.UTC(y, m - 1 + d, 1))
    return {
      value: dt.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt),
    }
  })
}
