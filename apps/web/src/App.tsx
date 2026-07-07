import { useState } from 'react'
import { todayIso } from './api'
import Chat from './Chat'
import Diario from './Diario'
import Evolucao from './Evolucao'

const TABS = ['Chat', 'Diário', 'Evolução'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  const [tab, setTab] = useState<Tab>('Chat')
  const [day, setDay] = useState(todayIso())

  const shiftDay = (delta: number) => {
    const d = new Date(`${day}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + delta)
    setDay(d.toISOString().slice(0, 10))
  }

  return (
    <div className="app">
      <header>
        <h1>🏋️ Marombas Tracker</h1>
        <nav aria-label="abas">
          {TABS.map((t) => (
            <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        {tab !== 'Evolução' && (
          <div className="day-picker">
            <button aria-label="dia anterior" onClick={() => shiftDay(-1)}>
              ◀
            </button>
            <input
              aria-label="dia"
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
            <button aria-label="próximo dia" onClick={() => shiftDay(1)}>
              ▶
            </button>
          </div>
        )}
      </header>
      {tab === 'Chat' && <Chat day={day} />}
      {tab === 'Diário' && <Diario day={day} />}
      {tab === 'Evolução' && <Evolucao />}
    </div>
  )
}
