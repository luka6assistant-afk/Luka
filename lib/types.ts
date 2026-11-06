export type TxKind = 'expense' | 'income' | 'debt_payment' | 'saving'
export type TxStatus = 'pending' | 'confirmed'

export interface Family {
  id: string
  name: string
  currency: string
  telegram_chat_id: number | null
  link_code: string
  plan: 'trial' | 'familia' | 'plus'
  trial_ends_at: string
  paid_until: string | null
  last_reminder_at: string | null
  last_report_month?: string | null
  founder?: boolean
  founder_since?: string | null
  referral_code?: string
  referred_by?: string | null
  referral_rewarded_at?: string | null
  onboarding_sent?: string[]
  alert_threshold?: number
  created_at?: string
}

export interface Member {
  id: string
  family_id: string
  user_id: string | null
  telegram_user_id: number | null
  display_name: string
  role: 'admin' | 'member'
  privacy_notice_at: string | null
  whatsapp_phone?: string | null
  wa_edit_tx?: string | null
  wa_edit_at?: string | null
}

export interface Category {
  id: string
  family_id: string
  name: string
  kind: 'expense' | 'income'
  icon: string
  monthly_budget: number
}

export interface Debt {
  id: string
  family_id: string
  name: string
  creditor: string | null
  original_amount: number
  balance: number
  annual_rate: number
  monthly_payment: number
  due_day: number | null
  active: boolean
}

export interface SavingsGoal {
  id: string
  family_id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  active: boolean
}

export interface Transaction {
  id: string
  family_id: string
  kind: TxKind
  status: TxStatus
  amount: number
  occurred_on: string
  merchant: string | null
  description: string | null
  category_id: string | null
  debt_id: string | null
  savings_goal_id: string | null
  member_id: string | null
  payment_method: string | null
  source: 'telegram_photo' | 'telegram_text' | 'telegram_audio' | 'whatsapp_photo' | 'whatsapp_text' | 'whatsapp_audio' | 'web'
  receipt_path: string | null
  transcript: string | null
  edit_prompt_message_id: number | null
  latency_ms: number | null
  created_at: string
}

export const KIND_LABEL: Record<TxKind, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  debt_payment: 'Abono a deuda',
  saving: 'Ahorro',
}
