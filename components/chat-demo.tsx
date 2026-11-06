'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

type Msg =
  | { id: string; kind: 'photo'; caption: string }
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'voice'; seconds: number }
  | { id: string; kind: 'typing' }
  | { id: string; kind: 'card'; amount: string; merchant: string; category: string; who: string; transcript?: string }
  | { id: string; kind: 'alert'; text: string }
  | { id: string; kind: 'summary' }

/** Escenas del video: título del paso, mensajes visibles y duración (ms). */
const SCENES: { step: string; msgs: Msg[]; ms: number }[] = [
  { step: '1. Envían la foto del recibo al grupo', msgs: [{ id: 'p', kind: 'photo', caption: 'Mercado de la semana' }], ms: 2200 },
  { step: '2. Luka la lee…', msgs: [{ id: 'p', kind: 'photo', caption: 'Mercado de la semana' }, { id: 't1', kind: 'typing' }], ms: 1600 },
  {
    step: '2. …y registra el gasto con su categoría',
    msgs: [
      { id: 'p', kind: 'photo', caption: 'Mercado de la semana' },
      { id: 'c1', kind: 'card', amount: '$185.400', merchant: 'Supermercado', category: '🛒 Mercado', who: 'Ana · Nequi' },
    ],
    ms: 3200,
  },
  {
    step: '3. Les avisa si se están pasando del presupuesto',
    msgs: [
      { id: 'c1', kind: 'card', amount: '$185.400', merchant: 'Supermercado', category: '🛒 Mercado', who: 'Ana · Nequi' },
      { id: 'a1', kind: 'alert', text: '⚠️ Mercado: van en 82 % del presupuesto del mes.' },
    ],
    ms: 3000,
  },
  {
    step: '4. También entiende notas de voz y mensajes',
    msgs: [
      { id: 'a1', kind: 'alert', text: '⚠️ Mercado: van en 82 % del presupuesto del mes.' },
      { id: 'v', kind: 'voice', seconds: 4 },
      { id: 't2', kind: 'typing' },
    ],
    ms: 2000,
  },
  {
    step: '4. También entiende notas de voz y mensajes',
    msgs: [
      { id: 'v', kind: 'voice', seconds: 4 },
      { id: 'c2', kind: 'card', amount: '$60.000', merchant: 'Gasolina', category: '🚗 Transporte', who: 'Juan · Efectivo', transcript: 'pagué 60 mil de gasolina' },
    ],
    ms: 3200,
  },
  { step: '5. El día 1 les llega el resumen del mes', msgs: [{ id: 's', kind: 'summary' }], ms: 4800 },
]

export function ChatDemo() {
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setReduced(mq.matches)
      if (mq.matches) setPlaying(false)
    }
    mq.addEventListener('change', apply)
    const t = setTimeout(apply, 0)
    return () => {
      clearTimeout(t)
      mq.removeEventListener('change', apply)
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENES[scene].ms)
    return () => clearTimeout(t)
  }, [scene, playing])

  const current = SCENES[scene]
  const stepIndex = Number(current.step[0]) - 1

  return (
    <figure className="mx-auto w-full max-w-sm" aria-label="Demostración animada de cómo funciona Luka">
      <div className="rounded-[2rem] border-8 border-ink bg-[#e7ebe4] shadow-xl">
        <div className="flex items-center gap-2 rounded-t-[1.5rem] border-b border-black/10 bg-white/70 px-4 py-3">
          <Image src="/luka-icon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full bg-white" />
          <div>
            <p className="text-sm font-semibold text-ink">Familia Pérez</p>
            <p className="text-xs text-slate-600">Ana, Juan, Luka</p>
          </div>
        </div>
        <div className="flex h-[22rem] flex-col justify-end gap-3 overflow-hidden p-4 text-sm" aria-live="polite">
          {current.msgs.map((m) => (
            <Bubble key={m.id} m={m} animate={!reduced} />
          ))}
        </div>
      </div>

      <figcaption className="mt-4">
        <p className="min-h-[3rem] text-center font-medium text-ink">{current.step}</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            aria-label={playing ? 'Pausar la demostración' : 'Reproducir la demostración'}
          >
            {playing ? '⏸ Pausar' : '▶ Reproducir'}
          </button>
          <div className="flex gap-1.5" role="group" aria-label="Pasos de la demostración">
            {[0, 1, 2, 3, 4].map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir al paso ${i + 1}`}
                aria-current={i === stepIndex ? 'step' : undefined}
                onClick={() => setScene(SCENES.findIndex((s) => s.step.startsWith(`${i + 1}.`)))}
                className={`h-2.5 rounded-full transition-all ${i === stepIndex ? 'w-6 bg-brand-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`}
              />
            ))}
          </div>
        </div>
      </figcaption>
    </figure>
  )
}

function Bubble({ m, animate }: { m: Msg; animate: boolean }) {
  const enter = animate ? 'animate-[luka-in_0.35s_ease-out]' : ''
  const mine = 'ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3'
  const bot = 'max-w-[88%] rounded-2xl rounded-bl-sm bg-white p-3 shadow-sm'
  switch (m.kind) {
    case 'photo':
      return (
        <div className={`${mine} ${enter}`}>
          <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-white/70 text-3xl" aria-hidden>
            🧾
          </div>
          <p className="text-slate-800">{m.caption}</p>
        </div>
      )
    case 'text':
      return <div className={`${mine} ${enter} text-slate-800`}>{m.text}</div>
    case 'voice':
      return (
        <div className={`${mine} ${enter} flex items-center gap-2 text-slate-800`}>
          <span aria-hidden>▶</span>
          <span className="flex h-4 items-end gap-0.5" aria-hidden>
            {[3, 6, 9, 5, 8, 4, 7, 10, 6, 3, 5, 8].map((h, i) => (
              <span key={i} className="w-1 rounded-full bg-brand-600/70" style={{ height: `${h * 1.5}px` }} />
            ))}
          </span>
          <span className="text-xs text-slate-600">0:0{m.seconds}</span>
          <span className="sr-only">Nota de voz</span>
        </div>
      )
    case 'typing':
      return (
        <div className={`${bot} ${enter} flex w-16 items-center justify-center gap-1`} aria-label="Luka está escribiendo">
          {[0, 150, 300].map((d) => (
            <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      )
    case 'card':
      return (
        <div className={`${bot} ${enter}`}>
          <p className="font-semibold text-slate-800">✅ Registrado · Gasto</p>
          <p className="mt-1 text-slate-700">
            💵 <b>{m.amount}</b>
          </p>
          <p className="text-slate-700">
            🏪 {m.merchant} · 🏷 {m.category}
          </p>
          <p className="text-slate-700">📅 Hoy · 👤 {m.who}</p>
          {m.transcript && <p className="mt-1 text-xs italic text-slate-600">🎙 «{m.transcript}»</p>}
          <div className="mt-2 grid grid-cols-2 gap-1 text-center text-xs font-medium text-brand-700">
            <span className="rounded-md bg-slate-100 py-1">✏️ Editar</span>
            <span className="rounded-md bg-slate-100 py-1">🏷 Categoría</span>
          </div>
        </div>
      )
    case 'alert':
      return <div className={`${bot} ${enter} text-slate-700`}>{m.text}</div>
    case 'summary':
      return (
        <div className="flex flex-col gap-2">
          <div className={`${bot} ${enter}`}>
            <p className="font-semibold text-slate-800">📅 Resumen de octubre</p>
            <p className="mt-1 text-slate-700">💰 Ingresos: <b>$5.200.000</b></p>
            <p className="text-slate-700">🛒 Gastos: <b>$3.870.000</b> (▼ 6 % vs. septiembre)</p>
            <p className="text-slate-700">✅ Balance: <b>$1.330.000</b></p>
            <div className="mt-2 space-y-1 text-xs text-slate-700">
              {[
                ['🏠 Hogar', 38],
                ['🛒 Mercado', 24],
                ['🚗 Transporte', 14],
              ].map(([label, pct]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="w-24 shrink-0">{label}</span>
                  <span className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                  <span>{pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`${bot} ${enter} flex items-center gap-2 text-slate-700`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white" aria-hidden>
              CSV
            </span>
            <span>
              <span className="block font-medium text-slate-800">luka-2026-10.csv</span>
              <span className="text-xs text-slate-600">Todos los movimientos, para Excel</span>
            </span>
          </div>
        </div>
      )
  }
}
