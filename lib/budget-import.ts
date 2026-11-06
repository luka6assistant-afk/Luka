import 'server-only'
import ExcelJS from 'exceljs'
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
  if (!name.endsWith('.xlsx')) throw new Error('Formato no soportado. Guarda el archivo como .xlsx o .csv.')
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

export const BudgetSchema = z.object({
  understood: z.boolean().describe('false si el archivo no parece un presupuesto ni una lista de gastos/ingresos'),
  items: z
    .array(
      z.object({
        name: z.string().describe('Nombre corto de la categoría en español, con mayúscula inicial (máx. 30 caracteres)'),
        kind: z.enum(['expense', 'income']).describe('expense=gasto, income=ingreso'),
        monthly_amount: z.number().describe('Monto MENSUAL en pesos colombianos, sin separadores. Si la hoja es anual, divide entre 12; si es quincenal, multiplica por 2'),
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

export async function interpretBudgetSheet(text: string, existing: Category[]) {
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
      '- Agrupa subconceptos muy pequeños en categorías razonables (máximo 20 categorías). No inventes montos que no estén.',
      '- Si una categoría existente significa lo mismo (ej. "Supermercado" = "Mercado", "Servicios públicos" = "Servicios"), pon su nombre EXACTO en existing_category.',
      `Categorías existentes: ${existing.map((c) => `${c.name} (${c.kind === 'income' ? 'ingreso' : 'gasto'})`).join(', ') || '(ninguna)'}.`,
    ].join('\n'),
    messages: [{ role: 'user', content: `Contenido de la hoja de cálculo:\n\n${text}` }],
  })
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null
  return response.parsed_output ?? null
}
