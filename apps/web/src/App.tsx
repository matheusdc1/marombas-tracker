import { useState } from 'react'
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  MessageCircle,
  TrendingUp,
} from 'lucide-react'
import { todayIso } from './api'
import Chat from './Chat'
import Diario from './Diario'
import Evolucao from './Evolucao'
import Fotos from './Fotos'
import Landing from './Landing'

const TABS = [
  { name: 'Chat', icon: MessageCircle },
  { name: 'Diário', icon: CalendarDays },
  { name: 'Evolução', icon: TrendingUp },
  { name: 'Fotos', icon: Camera },
] as const

type Tab = (typeof TABS)[number]['name']

export default function App() {
  const [started, setStarted] = useState(false)
  const [tab, setTab] = useState<Tab>('Chat')
  const [day, setDay] = useState(todayIso())

  const shiftDay = (delta: number) => {
    const d = new Date(`${day}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + delta)
    setDay(d.toISOString().slice(0, 10))
  }

  if (!started) {
    return <Landing onStart={() => setStarted(true)} />
  }

  return (
    <div className="app">
      <header>
        <h1>
          <Dumbbell size={24} className="logo" aria-hidden />
          Marombas Tracker
        </h1>
        <div className="toolbar">
          <nav aria-label="abas">
            {TABS.map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={name === tab ? 'active' : ''}
                onClick={() => setTab(name)}
              >
                <Icon size={16} aria-hidden />
                {name}
              </button>
            ))}
          </nav>
          {(tab === 'Chat' || tab === 'Diário') && (
            <div className="day-picker">
              <button aria-label="dia anterior" onClick={() => shiftDay(-1)}>
                <ChevronLeft size={18} aria-hidden />
              </button>
              <input
                aria-label="dia"
                type="date"
                value={day}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
              <button aria-label="próximo dia" onClick={() => shiftDay(1)}>
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </header>
      {tab === 'Chat' && <Chat day={day} />}
      {tab === 'Diário' && <Diario day={day} />}
      {tab === 'Evolução' && <Evolucao />}
      {tab === 'Fotos' && <Fotos />}
    </div>
  )
}
