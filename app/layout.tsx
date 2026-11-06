import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { CookieNotice } from '@/components/cookie-notice'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Luka — las cuentas de la casa',
  description: 'Gastos, presupuesto y ahorros de la familia, desde el chat de Telegram',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geist.variable}>
      <body>
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {children}
        <CookieNotice />
      </body>
    </html>
  )
}
