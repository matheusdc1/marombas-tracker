import { ArrowRight, CalendarDays, Dumbbell, MessageCircle, TrendingUp } from 'lucide-react'

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'Chat Inteligente',
    text: 'Registre alimentação e treino em linguagem natural.',
  },
  {
    icon: CalendarDays,
    title: 'Diário',
    text: 'Acompanhe calorias, macros e volume de treino.',
  },
  {
    icon: TrendingUp,
    title: 'Evolução',
    text: 'Veja gráficos e acompanhe seu progresso.',
  },
]

export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main className="landing">
      <span className="landing-logo">
        <Dumbbell size={40} aria-hidden />
      </span>
      <h1>Marombas Tracker</h1>
      <p className="landing-subtitle">Seu diário inteligente de treino e alimentação.</p>
      <p className="landing-desc">
        Conte em uma mensagem o que você comeu e treinou: o Marombas Tracker calcula calorias e
        macronutrientes pela tabela TACO, registra suas séries e mostra a progressão de cargas ao
        longo do tempo.
      </p>
      <button className="landing-cta" onClick={onStart}>
        Vamos começar
        <ArrowRight size={18} aria-hidden />
      </button>
      <div className="landing-cards">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div className="landing-card" key={title}>
            <span className="tile-icon">
              <Icon size={18} aria-hidden />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
