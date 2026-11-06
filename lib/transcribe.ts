import 'server-only'

/**
 * Transcribe una nota de voz de Telegram (OGG/Opus) con Deepgram nova-3 en español latino.
 * La API de Claude no recibe audio, por eso se pasa primero a texto.
 */
export async function transcribe(audio: Buffer, mimeType = 'audio/ogg'): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) throw new Error('Falta DEEPGRAM_API_KEY')
  const params = new URLSearchParams({ model: 'nova-3', language: 'es-419', smart_format: 'true', punctuate: 'true',
    // Excluye los audios del programa de mejora de modelos de Deepgram (no se usan para entrenar)
    mip_opt_out: 'true',
  })
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': mimeType },
    body: new Uint8Array(audio),
  })
  if (!res.ok) throw new Error(`Deepgram respondió ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] }
  }
  return body.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ''
}

export const transcriptionEnabled = () => !!process.env.DEEPGRAM_API_KEY
