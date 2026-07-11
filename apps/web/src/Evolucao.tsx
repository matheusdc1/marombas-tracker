import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Trophy } from 'lucide-react'
import { addWeight, getExercises, getMetrics, getPrs, todayIso } from './api'
import LineChart from './LineChart'
import type { Metrics, Pr } from './types'

const METRIC_OPTIONS = [
  { value: 'volume', label: 'Volume de treino' },
  { value: 'peso', label: 'Peso corporal' },
  { value: 'calorias', label: 'Calorias' },
  { value: 'proteina', label: 'Proteína' },
  { value: 'agua', label: 'Água' },
  { value: 'exercicio', label: 'Peso levantado por exercício' },
] as const

type MetricKey = (typeof METRIC_OPTIONS)[number]['value']

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano' },
]

export default function Evolucao() {
  const [metric, setMetric] = useState<MetricKey>('volume')
  const [days, setDays] = useState(30)
  const [exercise, setExercise] = useState('')
  const [exercises, setExercises] = useState<string[]>([])
  const [data, setData] = useState<Metrics | null>(null)
  const [prs, setPrs] = useState<Pr[]>([])
  const [error, setError] = useState('')
  const [weightKg, setWeightKg] = useState('')

  const loadMetrics = useCallback(() => {
    setError('')
    getMetrics(metric, days, metric === 'exercicio' ? exercise : '')
      .then(setData)
      .catch(() => setError('Não consegui carregar a evolução. A API está rodando em :8000?'))
  }, [metric, days, exercise])

  useEffect(loadMetrics, [loadMetrics])

  useEffect(() => {
    getExercises()
      .then((list) => {
        setExercises(list)
        if (list.length) setExercise(list[0])
      })
      .catch(() => setExercises([]))
    getPrs()
      .then(setPrs)
      .catch(() => setPrs([]))
  }, [])

  function submitWeight(e: FormEvent) {
    e.preventDefault()
    addWeight(todayIso(), Number(weightKg))
      .then(() => {
        setWeightKg('')
        loadMetrics()
      })
      .catch(() => setError('Falha ao registrar o peso. A API está rodando em :8000?'))
  }

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === metric)!.label
  const first = data?.points[0]
  const last = data?.points[data.points.length - 1]
  const delta = first && last ? Math.round((last.value - first.value) * 10) / 10 : 0

  return (
    <section className="evolucao">
      <h2>Evolução</h2>
      <p className="muted">Escolha a métrica e o período — volume = séries × reps × carga.</p>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p>Carregando…</p>}
      {data && (
        <>
          <div className="filters">
            <label className="field">
              métrica
              <select
                aria-label="métrica"
                value={metric}
                onChange={(e) => setMetric(e.target.value as MetricKey)}
              >
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              período
              <select
                aria-label="período"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {PERIODS.map((p) => (
                  <option key={p.days} value={p.days}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {metric === 'exercicio' && (
              <label className="field">
                exercício
                <select
                  aria-label="exercício"
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value)}
                >
                  {exercises.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {metric === 'peso' && (
            <form className="add-form" onSubmit={submitWeight}>
              <input
                aria-label="peso em kg"
                type="number"
                min="1"
                step="0.1"
                placeholder="peso de hoje (kg)"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
              <button aria-label="registrar peso" disabled={!weightKg}>
                <Plus size={16} aria-hidden />
                Registrar
              </button>
            </form>
          )}
          {data.points.length === 0 ? (
            <p className="empty">Sem registros neste período.</p>
          ) : (
            <>
              <div className="tiles">
                {metric === 'peso' && first && last ? (
                  <>
                    <div className="tile">
                      <span className="tile-label">Peso inicial</span>
                      <span className="tile-value">{first.value}</span>
                      <span className="tile-unit">kg em {first.day}</span>
                    </div>
                    <div className="tile">
                      <span className="tile-label">Peso atual</span>
                      <span className="tile-value">{last.value}</span>
                      <span className="tile-unit">kg em {last.day}</span>
                    </div>
                    <div className="tile">
                      <span className="tile-label">Diferença</span>
                      <span className="tile-value">
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                      <span className="tile-unit">kg no período</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tile">
                      <span className="tile-label">Registros no período</span>
                      <span className="tile-value">{data.points.length}</span>
                      <span className="tile-unit">dias</span>
                    </div>
                    <div className="tile">
                      <span className="tile-label">Máximo</span>
                      <span className="tile-value">
                        {Math.max(...data.points.map((p) => p.value))}
                      </span>
                      <span className="tile-unit">{data.unit}</span>
                    </div>
                  </>
                )}
              </div>
              <LineChart
                points={data.points}
                unit={data.unit}
                label={`Evolução de ${metricLabel.toLowerCase()} por dia`}
              />
            </>
          )}
          <details className="pr-history">
            <summary>
              <Trophy size={14} aria-hidden /> Histórico de PRs ({prs.length})
            </summary>
            {prs.length === 0 ? (
              <p className="empty">Nenhum PR registrado ainda.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Exercício</th>
                    <th>Carga (kg)</th>
                    <th>Dia</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.map((pr, i) => (
                    <tr key={i}>
                      <td>{pr.exercise}</td>
                      <td>{pr.weight_kg}</td>
                      <td>{pr.day}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </details>
        </>
      )}
    </section>
  )
}
