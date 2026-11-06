import type { Extraction } from '../extract'
import type { LedgerContext } from '../ledger'
import { dateLabel, money } from '../format'
import { KIND_LABEL, type Transaction } from '../types'

/** Convierte el HTML de Telegram al formato de WhatsApp (*negrita*, _cursiva_). */
export function htmlToWa(html: string): string {
  return html
    .replace(/<b>([\s\S]*?)<\/b>/g, '*$1*')
    .replace(/<i>([\s\S]*?)<\/i>/g, '_$1_')
    .replace(/<a href="([^"]+)">([\s\S]*?)<\/a>/g, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Quita los caracteres que WhatsApp usa para dar formato, en textos que vienen de la persona o de la IA. */
const plain = (s: string) => s.replace(/[*_~`]/g, '')

export function waCard(tx: Transaction, ctx: LedgerContext, who: string, ex?: Extraction) {
  const cat = ctx.categories.find((c) => c.id === tx.category_id)
  return [
    `${tx.status === 'pending' ? '🕓 *Por confirmar*' : '✅ *Registrado*'} · ${KIND_LABEL[tx.kind]}`,
    `💵 *${money(tx.amount)}*`,
    tx.merchant ? `🏪 ${plain(tx.merchant)}` : null,
    tx.description ? `📝 ${plain(tx.description)}` : null,
    tx.kind === 'expense' || tx.kind === 'income' ? `🏷 ${cat ? `${cat.icon} ${cat.name}` : 'Sin categoría'}` : null,
    tx.kind === 'saving' ? `🐷 ${plain(ctx.goals.find((g) => g.id === tx.savings_goal_id)?.name ?? 'Meta sin identificar')}` : null,
    `📅 ${dateLabel(tx.occurred_on)} · 👤 ${plain(who)}${tx.payment_method ? ` · ${plain(tx.payment_method)}` : ''}`,
    tx.transcript ? `🎙 _«${plain(tx.transcript)}»_` : null,
    ex?.notes ? `⚠️ _${plain(ex.notes)}_` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Botones de la tarjeta (WhatsApp permite máximo 3). */
export function cardButtons(tx: Transaction) {
  return tx.status === 'pending'
    ? [
        { id: `ok:${tx.id}`, title: '✅ Confirmar' },
        { id: `ed:${tx.id}`, title: '✏️ Editar' },
        { id: `del:${tx.id}`, title: '🗑 Eliminar' },
      ]
    : [
        { id: `ed:${tx.id}`, title: '✏️ Editar' },
        { id: `cat:${tx.id}`, title: '🏷 Categoría' },
        { id: `del:${tx.id}`, title: '🗑 Eliminar' },
      ]
}
