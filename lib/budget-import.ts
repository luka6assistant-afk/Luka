import 'server-only'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { Category } from './types'

/**
 * Importar el presupuesto desde una hoja de cálculo: se convierte la hoja a texto y Claude identifica
 * las categorías y sus montos mensuales, sin importar cómo esté organizada.
 */

const client = new Anthropic()
const MODEL = 'claude-opus-5-5'
export const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 400
const MAX_CHARS = 40_000

/** Convierte un .xlsx o .csv a texto plano (una fila por línea, celdas separadas por " | "). */
export async function sheetToText(buf: Buffer, filename: string): Promise<string> {
  const name = filename.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    let text = buf.toString('utf8').replace(/^﻿/, '')
    if (text.includes('�')) text = buf.toString('latin1') // archivos guardados con Excel en Windows (ANSI)
    return text.split(/\r?\n/).slice(0, MAX_ROWS).join('\n').slice(0, MAX_CHARS)
  }
  if (name.endsWith('.xls')) throw new Error('Formato no soportado: es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx o .csv.')
  if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm')) throw new Error('Formato no soportado. Guarda el archivo como .xlsx o .csv.')
  try {
    return await readWithExcelJS(buf)
  } catch (err) {
    // Algunos archivos (formato estricto, gráficos, exportados desde otras apps) hacen fallar a exceljs:
    // se leen con un lector más simple que solo saca los valores de las celdas
    console.error('exceljs no pudo leer el archivo; uso el lector simple', err)
    return readXlsxValues(buf)
  }
}

async function readWithExcelJS(buf: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const lines: string[] = []
  for (const ws of wb.worksheets.slice(0, 5)) {
    lines.push(`### Hoja: ${ws.name}`)
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (lines.length > MAX_ROWS) return
      const cells: string[] = []
      row.eachCell({ includeEmpty: false }, (cell) => {
        const t = (cell.text ?? '').toString().trim()
        if (t) cells.push(t)
      })
      if (cells.length) lines.push(cells.join(' | '))
    })
  }
  return lines.join('\n').slice(0, MAX_CHARS)
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')

/** Lector simple de .xlsx: abre el zip y saca los valores de las celdas de cada hoja (sin formato). */
export async function readXlsxValues(buf: Buffer): Promise<string> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buf)
  } catch {
    throw new Error('No pude abrir el archivo. Si tiene contraseña, quítasela; si no, guárdalo como .csv e inténtalo de nuevo.')
  }
  const shared: string[] = []
  const ss = await zip.file('xl/sharedStrings.xml')?.async('string')
  for (const si of ss?.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    shared.push(decodeXml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('')))
  }
  const sheets = Object.keys(zip.files)
    .filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .slice(0, 5)
  const lines: string[] = []
  for (const path of sheets) {
    lines.push(`### Hoja ${path.match(/\d+/)![0]}`)
    const xml = (await zip.file(path)!.async('string')) ?? ''
    for (const row of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
      if (lines.length > MAX_ROWS) break
      const cells: string[] = []
      for (const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
        const type = c.match(/\bt="([^"]+)"/)?.[1]
        const v = c.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        const inline = c.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/)?.[1]
        const value = type === 's' && v !== undefined ? shared[Number(v)] : inline !== undefined ? decodeXml(inline) : v !== undefined ? decodeXml(v) : ''
        if (value?.trim()) cells.push(value.trim())
      }
      if (cells.length) lines.push(cells.join(' | '))
    }
  }
  const text = lines.join('\n').slice(0, MAX_CHARS)
  if (!text.replace(/### Hoja \d+/g, '').trim()) throw new Error('No encontré datos en el archivo. Guárdalo como .csv e inténtalo de nuevo.')
  return text
}

export const BudgetSchema = z.object({
  understood: z.boolean().describe('false si el archivo no parece un presupuesto ni una lista de gastos/ingresos'),
  items: z
    .array(
      z.object({
        name: z.string().describe('Nombre corto de la categoría en español, con mayúscula inicial (máx. 30 caracteres)'),
        kind: z.enum(['expense', 'income', 'debt']).describe('expense=gasto, income=ingreso, debt=una deuda (tarjeta, crédito, préstamo, cuota de lote, vehículo o vivienda)'),
        monthly_amount: z.number().describe('Monto MENSUAL en pesos colombianos, sin separadores (para deudas: la cuota mensual). Si la hoja es anual, divide entre 12; si es quincenal, multiplica por 2'),
        balance: z.number().nullable().describe('Solo deudas: saldo pendiente si aparece en la hoja, o null'),
        annual_rate_pct: z.number().nullable().describe('Solo deudas: tasa de interés efectiva anual en porcentaje (ej. 28) si aparece, o null'),
        existing_debt: z.string().nullable().describe('Solo deudas: nombre EXACTO de una deuda ya registrada que sea la misma, o null'),
        icon: z.string().describe('Un emoji que represente la categoría'),
        existing_category: z
          .string()
          .nullable()
          .describe('Nombre EXACTO de una categoría existente que signifique lo mismo, o null si es nueva'),
        note: z.string().nullable().describe('Aclaración breve si hubo que agrupar, convertir o suponer algo, o null'),
      }),
    )
    .describe('Una fila por categoría. Si la hoja tiene subconceptos (ej. luz, agua, gas), agrúpalos en una categoría con la suma'),
})
export type BudgetItem = z.infer<typeof BudgetSchema>['items'][number]

export async function interpretBudgetSheet(text: string, existing: Category[], debts: { name: string }[] = []) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(BudgetSchema) },
    system: [
      'Lees la hoja de cálculo del presupuesto mensual de una familia colombiana y extraes sus categorías con el monto mensual.',
      'Reglas:',
      '- Montos en pesos colombianos (COP). "1.200.000", "$1,2M" y "1200000" son lo mismo. Ignora totales y subtotales.',
      '- Si hay varias columnas de meses, usa el presupuesto típico de un mes (el más reciente o el promedio), no la suma.',
      '- Si hay columnas de "presupuesto" y "real/gastado", usa la de presupuesto.',
      '- Agrupa subconceptos muy pequeños de gastos en categorías razonables (máximo 20). No inventes montos que no estén.',
      '- Las DEUDAS NO se agrupan: cada tarjeta, crédito, préstamo o cuota (lote, carro, vivienda, libre inversión) va por separado con kind=debt, su cuota mensual y, si aparecen, saldo y tasa.',
      '- Si una categoría existente significa lo mismo (ej. "Supermercado" = "Mercado", "Servicios públicos" = "Servicios"), pon su nombre EXACTO en existing_category.',
      `Categorías existentes: ${existing.map((c) => `${c.name} (${c.kind === 'income' ? 'ingreso' : 'gasto'})`).join(', ') || '(ninguna)'}.`,
      `Deudas ya registradas: ${debts.map((d) => d.name).join(', ') || '(ninguna)'}.`,
    ].join('\n'),
    messages: [{ role: 'user', content: `Contenido de la hoja de cálculo:\n\n${text}` }],
  })
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null
  return response.parsed_output ?? null
}
