import { useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, Send } from 'lucide-react'
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
      <h2>Chat</h2>
      <p className="muted">Conte o que comeu e treinou — o registro cai no diário do dia.</p>
      <p className="mock-note">
        <Bot size={16} aria-hidden />
        Resposta gerada por IA com acesso à tabela TACO — o registro no diário é real.
        Sem chave de LLM configurada, um parser offline assume.
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
        {busy && (
          <pre className="msg bot pending" aria-live="polite">
            Registrando no diário…
          </pre>
        )}
      </div>
      <form onSubmit={submit}>
        <textarea
          aria-label="mensagem"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={HINT}
          rows={3}
        />
        <button aria-label="Enviar" disabled={busy || !text.trim()}>
          <Send size={16} aria-hidden />
        </button>
      </form>
    </section>
  )
}
