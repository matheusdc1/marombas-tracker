import { useEffect, useState } from 'react'
import { getProgress } from './api'
import LineChart from './LineChart'
import type { Progress } from './types'

export default function Evolucao() {
  const [filter, setFilter] = useState('')
  const [data, setData] = useState<Progress | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    getProgress(filter)
      .then(setData)
      .catch(() => setError('Não consegui carregar a evolução. A API está rodando em :8000?'))
  }, [filter])

  return (
    <section className="evolucao">
      <h2>Evolução de cargas</h2>
      <p className="muted">Volume = séries × repetições × carga (kg), somado por dia.</p>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p>Carregando…</p>}
      {data && (
        <>
          <label className="filter">
            Exercício:{' '}
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">todos (volume total)</option>
              {data.exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </label>
          {data.points.length === 0 ? (
            <p className="empty">
              Nenhum treino registrado ainda. Registre pelo chat ou pelo diário.
            </p>
          ) : (
            <>
              <div className="tiles">
                <div className="tile">
                  <span className="tile-value">{data.points.length}</span>
                  <span className="tile-label">dias de treino</span>
                </div>
                <div className="tile">
                  <span className="tile-value">
                    {Math.max(...data.points.map((p) => p.volume_kg))} kg
                  </span>
                  <span className="tile-label">recorde de volume</span>
                </div>
              </div>
              <LineChart points={data.points} />
            </>
          )}
        </>
      )}
    </section>
  )
}
