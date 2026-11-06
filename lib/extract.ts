import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { Category, Debt, SavingsGoal } from './types'
import { todayISO } from './format'

const client = new Anthropic()

const MODEL = 'claude-opus-5-5'

export const ExtractionSchema = z.object({
  is_financial: z
    .boolean()
    .describe('false si el mensaje/imagen no es un recibo, factura, comprobante ni un movimiento de dinero'),
  kind: z
    .enum(['expense', 'income', 'debt_payment', 'saving'])
    .describe('expense=gasto, income=ingreso, debt_payment=abono a una deuda, saving=aporte a una meta de ahorro'),
  amount: z.number().describe('Monto TOTAL pagado en pesos colombianos, sin separadores. 0 si no se puede leer'),
  occurred_on: z.string().describe('Fecha del movimiento YYYY-MM-DD'),
  merchant: z.string().nullable().describe('Comercio, empresa o persona'),
  description: z.string().describe('Descripción corta en español (máx. 80 caracteres)'),
  category_name: z.string().nullable().describe('Nombre EXACTO de una de las categorías disponibles, o null'),
  debt_name: z.string().nullable().describe('Nombre EXACTO de la deuda si kind=debt_payment, o null'),
  savings_goal_name: z.string().nullable().describe('Nombre EXACTO de la meta si kind=saving, o null'),
  payment_method: z
    .string()
    .nullable()
    .describe('Efectivo, Nequi, Daviplata, tarjeta débito, tarjeta crédito, transferencia, PSE... o null'),
  invoice_number: z.string().nullable().describe('Número de factura o CUFE si aparece, o null'),
  confidence: z.enum(['alta', 'media', 'baja']),
  notes: z.string().nullable().describe('Dudas o advertencias para el usuario (ej. monto ilegible), o null'),
})

export type Extraction = z.infer<typeof ExtractionSchema>

export interface ExtractionContext {
  categories: Category[]
  debts: Debt[]
  goals: SavingsGoal[]
  senderName: string
  /** Módulo de deudas activo: los abonos van a la deuda (no a una categoría de gasto) */
  debtsEnabled?: boolean
}

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

export type ExtractionInput =
  | { type: 'image'; base64: string; mediaType: ImageMediaType; caption?: string }
  | { type: 'pdf'; base64: string; caption?: string }
  | { type: 'text'; text: string }

function systemPrompt(ctx: ExtractionContext): string {
  const expenseCats = ctx.categories.filter((c) => c.kind === 'expense').map((c) => c.name)
  const shownExpense = ctx.debtsEnabled ? expenseCats.filter((n) => !/^deudas?$/i.test(n)) : expenseCats
  const incomeCats = ctx.categories.filter((c) => c.kind === 'income').map((c) => c.name)
  return [
    'Eres el contador de una familia colombiana. Recibes capturas de pantalla, fotos de recibos, facturas',
    'electrónicas DIAN, comprobantes de Nequi/Daviplata/Bancolombia, o mensajes de texto cortos del chat familiar,',
    'y extraes UN movimiento de dinero.',
    '',
    'Reglas:',
    '- Montos en COP. En Colombia el punto separa miles y la coma decimales: "$45.900" = 45900.',
    '- Usa el TOTAL a pagar (con IVA y propina), no subtotales.',
    `- Hoy es ${todayISO()}. Si no aparece la fecha, usa hoy. "ayer" = el día anterior.`,
    ctx.debtsEnabled || ctx.debts.length
      ? '- Cuotas, abonos o pagos de tarjetas, créditos, préstamos, lotes o vehículos son debt_payment; pon en debt_name la deuda que coincida (o null si ninguna coincide).'
      : '- Cuotas, abonos o pagos de tarjetas de crédito y préstamos: kind=expense con la categoría "Deudas" (nunca debt_payment).',
    '- "ahorré", "aparté", "guardé para ..." es saving (aporte a una meta, no es una categoría de gasto). Salario, pago recibido, venta es income.',
    '- Si no es un movimiento financiero (memes, fotos, conversación), is_financial=false y amount=0.',
    `- Quien envía el mensaje: ${ctx.senderName}.`,
    '',
    `Categorías de gasto: ${shownExpense.join(', ') || '(ninguna)'}`,
    `Categorías de ingreso: ${incomeCats.join(', ') || '(ninguna)'}`,
    `Deudas activas: ${ctx.debts.map((d) => d.name).join(', ') || '(ninguna)'}`,
    `Metas de ahorro: ${ctx.goals.map((g) => g.name).join(', ') || '(ninguna)'}`,
  ].join('\n')
}

export async function extractTransaction(
  input: ExtractionInput,
  ctx: ExtractionContext,
): Promise<Extraction | null> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (input.type === 'image') {
    content.push({ type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.base64 } })
    content.push({ type: 'text', text: input.caption ? `Comentario del usuario: ${input.caption}` : 'Extrae el movimiento.' })
  } else if (input.type === 'pdf') {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.base64 } })
    content.push({ type: 'text', text: input.caption ? `Comentario del usuario: ${input.caption}` : 'Extrae el movimiento.' })
  } else {
    content.push({ type: 'text', text: `Mensaje: ${input.text}` })
  }

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // Si el modelo declina por un falso positivo de seguridad, el servidor reintenta con otro modelo
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(ExtractionSchema) },
    system: systemPrompt(ctx),
    messages: [{ role: 'user', content }],
  })

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null
  return response.parsed_output ?? null
}

// ---------------------------------------------------------------------
// Corrección en lenguaje natural ("son 125.000", "fue ayer", "es del Éxito")
// ---------------------------------------------------------------------

export const EditSchema = z.object({
  understood: z.boolean().describe('false si la instrucción no es una corrección del movimiento'),
  amount: z.number().nullable().describe('Nuevo monto en COP, o null si no cambia'),
  occurred_on: z.string().nullable().describe('Nueva fecha YYYY-MM-DD, o null si no cambia'),
  merchant: z.string().nullable().describe('Nuevo comercio, o null si no cambia'),
  description: z.string().nullable().describe('Nueva descripción, o null si no cambia'),
  kind: z.enum(['expense', 'income', 'saving']).nullable().describe('Nuevo tipo, o null si no cambia'),
  category_name: z.string().nullable().describe('Nombre EXACTO de la nueva categoría, o null si no cambia'),
  savings_goal_name: z.string().nullable().describe('Nombre EXACTO de la meta si pasa a ser ahorro, o null'),
  payment_method: z.string().nullable().describe('Nuevo medio de pago, o null si no cambia'),
})
export type EditPatch = z.infer<typeof EditSchema>

export async function interpretEdit(
  current: Record<string, unknown>,
  instruction: string,
  ctx: Pick<ExtractionContext, 'categories' | 'goals'>,
): Promise<EditPatch | null> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(EditSchema) },
    system: [
      'Corriges un movimiento de dinero de una familia colombiana según la instrucción del usuario.',
      'Devuelve SOLO los campos que cambian; el resto en null. Montos en COP ("125 mil" = 125000).',
      `Hoy es ${todayISO()}. Categorías: ${ctx.categories.map((c) => `${c.name} (${c.kind === 'income' ? 'ingreso' : 'gasto'})`).join(', ')}.`,
      `Metas de ahorro: ${ctx.goals.map((g) => g.name).join(', ') || '(ninguna)'}.`,
    ].join('\n'),
    messages: [
      { role: 'user', content: `Movimiento actual: ${JSON.stringify(current)}\n\nInstrucción: ${instruction}` },
    ],
  })
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null
  return response.parsed_output ?? null
}
