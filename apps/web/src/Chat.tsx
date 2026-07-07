import { useState } from 'react'
import type { FormEvent } from 'react'
import { sendChat } from './api'

interface Msg {
  role: 'user' | 'bot'
  text: string
}

const HINT =
  'Ex.: hoje comi 200g de frango, 100g de arroz cru, 30g de azeite… ' +
  'treinei 2 séries de supino reto 30kg de cada lado 10 reps'

export default function Chat({ day }: { day: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const message = text.trim()
    setMsgs((m) => [...m, { role: 'user', text: message }])
    setText('')
    setBusy(true)
    try {
      const res = await sendChat(day, message)
      setMsgs((m) => [...m, { role: 'bot', text: res.reply }])
    } catch {
      setMsgs((m) => [...m, { role: 'bot', text: 'Erro ao falar com a API. Ela está rodando em :8000?' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="chat">
      <p className="mock-note">
        🤖 Resposta simulada (mock) — nesta fase o LLM ainda não está integrado. O registro no
        diário é real.
      </p>
      <div className="messages">
        {msgs.length === 0 && (
          <p className="empty">
            Descreva sua dieta e o treino do dia em uma mensagem. {HINT}
          </p>
        )}
        {msgs.map((m, i) => (
          <pre key={i} className={`msg ${m.role}`}>
            {m.text}
          </pre>
        ))}
      </div>
      <form onSubmit={submit}>
        <textarea
          aria-label="mensagem"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={HINT}
          rows={3}
        />
        <button disabled={busy || !text.trim()}>Enviar</button>
      </form>
    </section>
  )
}
