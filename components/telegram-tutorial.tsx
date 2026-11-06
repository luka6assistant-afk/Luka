'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

/** Escenas del tutorial: lo que se ve en el celular, el texto del paso y la duración (ms). */
const SCENES = [
  { title: 'En el panel, entra a Familia y toca «Conectar con Telegram»', screen: 'panel', ms: 4200 },
  { title: 'Telegram se abre: toca «Crear grupo nuevo» (o elige el grupo que ya tienen)', screen: 'pick', ms: 4600 },
  { title: 'Ponle nombre al grupo y agrega a tu familia', screen: 'create', ms: 4600 },
  { title: 'Confirma que quieres agregar a Luka', screen: 'confirm', ms: 3600 },
  { title: '¡Listo! Luka confirma que el grupo quedó conectado', screen: 'linked', ms: 4600 },
  { title: 'Envíen el primer recibo y Luka lo registra', screen: 'first', ms: 5000 },
] as const

type Screen = (typeof SCENES)[number]['screen']

export function TelegramTutorial({ botName = 'LukaFamiliaBot' }: { botName?: string }) {
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setReduced(mq.matches)
      if (mq.matches) setPlaying(false)
    }
    const t = setTimeout(apply, 0)
    mq.addEventListener('change', apply)
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
  const enter = reduced ? '' : 'animate-[luka-in_0.35s_ease-out]'

  return (
    <figure className="mx-auto w-full max-w-xs" aria-label="Video tutorial: cómo conectar Luka a un grupo de Telegram">
      <div className="overflow-hidden rounded-[2rem] border-8 border-ink bg-white shadow-xl">
        <div key={current.screen} className={`h-[26rem] text-sm ${enter}`} aria-live="polite">
          <PhoneScreen screen={current.screen} botName={botName} animate={!reduced} />
        </div>
      </div>
      <figcaption className="mt-4">
        <p className="min-h-[3rem] text-center font-medium text-ink">
          <span className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {scene + 1}
          </span>
          {current.title}
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {playing ? '⏸ Pausar' : '▶ Reproducir'}
          </button>
          <div className="flex gap-1.5" role="group" aria-label="Pasos del tutorial">
            {SCENES.map((s, i) => (
              <button
                key={s.screen}
                type="button"
                aria-label={`Ir al paso ${i + 1}: ${s.title}`}
                aria-current={i === scene ? 'step' : undefined}
                onClick={() => setScene(i)}
                className={`h-2.5 rounded-full transition-all ${i === scene ? 'w-6 bg-brand-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`}
              />
            ))}
          </div>
        </div>
      </figcaption>
    </figure>
  )
}

/** Dedo que "toca" un botón. */
function Tap({ animate }: { animate: boolean }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute -bottom-5 right-6 text-3xl ${animate ? 'animate-bounce' : ''}`}>
      👆
    </span>
  )
}

const TgBar = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="flex items-center gap-3 bg-[#517da2] px-4 py-3 text-white">
    <span aria-hidden>←</span>
    <div>
      <p className="font-semibold leading-tight">{title}</p>
      {sub && <p className="text-xs text-white/80">{sub}</p>}
    </div>
  </div>
)

function PhoneScreen({ screen, botName, animate }: { screen: Screen; botName: string; animate: boolean }) {
  switch (screen) {
    case 'panel':
      return (
        <div className="flex h-full flex-col bg-slate-50">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
            <Image src="/luka-icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
            <p className="font-semibold text-ink">Familia Pérez</p>
          </div>
          <div className="flex gap-2 overflow-hidden border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span>📊 Resumen</span>
            <span className="rounded bg-brand-50 px-1.5 font-medium text-brand-700">👨‍👩‍👧 Familia</span>
            <span>💎 Plan</span>
          </div>
          <div className="m-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-ink">📲 Conectar Telegram</p>
            <p className="mt-1 text-xs text-slate-600">Agrega a Luka al grupo de tu familia con un toque.</p>
            <div className="relative mt-4">
              <span className="block rounded-lg bg-brand-600 py-2.5 text-center font-semibold text-white ring-4 ring-brand-100">
                ➕ Conectar con Telegram
              </span>
              <Tap animate={animate} />
            </div>
          </div>
        </div>
      )
    case 'pick':
      return (
        <div className="flex h-full flex-col bg-white">
          <TgBar title="Elige un grupo" sub={`para agregar a @${botName}`} />
          <ul className="divide-y divide-slate-100">
            <li className="relative flex items-center gap-3 bg-sky-50 px-4 py-3 font-medium text-[#3a7bbf]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3a7bbf] text-white">＋</span>
              Crear grupo nuevo
              <Tap animate={animate} />
            </li>
            {['Familia Pérez 🏠', 'Primos', 'Trabajo'].map((g) => (
              <li key={g} className="flex items-center gap-3 px-4 py-3 text-slate-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200">👥</span>
                {g}
              </li>
            ))}
          </ul>
          <p className="mt-auto p-4 text-center text-xs text-slate-500">¿Ya tienen grupo? Elíjanlo de la lista.</p>
        </div>
      )
    case 'create':
      return (
        <div className="flex h-full flex-col bg-white">
          <TgBar title="Nuevo grupo" />
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-xl">📷</span>
            <span className="flex-1 border-b-2 border-[#3a7bbf] pb-1 font-medium text-ink">Familia Pérez</span>
          </div>
          <p className="px-4 pt-3 text-xs font-medium text-[#3a7bbf]">Miembros</p>
          <ul className="divide-y divide-slate-100">
            {[
              ['Luka 🤖', 'bot'],
              ['Juan', 'contacto'],
              ['Mamá', 'contacto'],
            ].map(([n, k]) => (
              <li key={n} className="flex items-center gap-3 px-4 py-2.5 text-slate-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs">{n[0]}</span>
                <span className="flex-1">{n}</span>
                <span className="text-xs text-slate-500">{k}</span>
                <span className="text-brand-600">✓</span>
              </li>
            ))}
          </ul>
          <div className="relative mt-auto self-end p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3a7bbf] text-xl text-white">✓</span>
            <Tap animate={animate} />
          </div>
        </div>
      )
    case 'confirm':
      return (
        <div className="flex h-full items-center justify-center bg-black/40 p-6">
          <div className="w-full rounded-xl bg-white p-5 shadow-lg">
            <p className="font-semibold text-ink">¿Agregar a Luka al grupo?</p>
            <p className="mt-2 text-xs text-slate-600">@{botName} podrá leer los mensajes del grupo para registrar los gastos.</p>
            <div className="relative mt-5 flex justify-end gap-5 text-sm font-semibold">
              <span className="text-slate-500">CANCELAR</span>
              <span className="text-[#3a7bbf]">AGREGAR</span>
              <Tap animate={animate} />
            </div>
          </div>
        </div>
      )
    case 'linked':
      return (
        <div className="flex h-full flex-col bg-[#e7ebe4]">
          <TgBar title="Familia Pérez" sub="3 miembros" />
          <div className="flex flex-1 flex-col justify-end gap-3 p-3">
            <p className="mx-auto rounded-full bg-black/20 px-3 py-0.5 text-xs text-white">Ana agregó a Luka</p>
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold text-brand-700">Luka</p>
              <p className="text-slate-800">
                ✅ ¡Listo! Este grupo quedó conectado a <b>Familia Pérez</b>.
              </p>
              <p className="mt-1 text-slate-700">📸 Prueben ya: envíen la foto de un recibo.</p>
            </div>
          </div>
        </div>
      )
    case 'first':
      return (
        <div className="flex h-full flex-col bg-[#e7ebe4]">
          <TgBar title="Familia Pérez" sub="3 miembros" />
          <div className="flex flex-1 flex-col justify-end gap-3 p-3">
            <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3">
              <div className="mb-1 flex h-16 items-center justify-center rounded-lg bg-white/70 text-2xl" aria-hidden>
                🧾
              </div>
              <p className="text-slate-800">Mercado</p>
            </div>
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white p-3 shadow-sm">
              <p className="font-semibold text-slate-800">✅ Registrado · Gasto</p>
              <p className="text-slate-700">
                💵 <b>$185.400</b> · 🛒 Mercado
              </p>
              <p className="text-slate-700">👤 Ana · Hoy</p>
            </div>
          </div>
        </div>
      )
  }
}
