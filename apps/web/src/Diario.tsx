import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Beef, Droplets, Dumbbell, Flame, Plus, Wheat, X } from 'lucide-react'
import { addMeal, addSet, deleteMeal, deleteSet, getFoods, getReport } from './api'
import type { Food, Report } from './types'

export default function Diario({ day }: { day: string }) {
  const [report, setReport] = useState<Report | null>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [error, setError] = useState('')
  const [foodId, setFoodId] = useState('')
  const [grams, setGrams] = useState('100')
  const [exercise, setExercise] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [weight, setWeight] = useState('20')

  async function run(action?: () => Promise<unknown>) {
    try {
      setError('')
      await action?.()
      setReport(await getReport(day))
    } catch {
      setError('Falha ao falar com a API. Ela está rodando em :8000?')
    }
  }

  useEffect(() => {
    setReport(null)
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  useEffect(() => {
    getFoods('').then(setFoods).catch(() => setFoods([]))
  }, [])

  function submitMeal(e: FormEvent) {
    e.preventDefault()
    void run(() => addMeal(day, Number(foodId), Number(grams)))
  }

  function submitSet(e: FormEvent) {
    e.preventDefault()
    void run(() =>
      addSet(day, {
        exercise: exercise.trim(),
        sets: Number(sets),
        reps: Number(reps),
        weight_kg: Number(weight),
      }),
    )
  }

  return (
    <section className="diario">
      <h2>Diário de {day}</h2>
      {error && <p className="error">{error}</p>}
      {!report && !error && <p>Carregando…</p>}
      {report && (
        <>
          <div className="tiles">
            {[
              { label: 'Calorias', unit: 'kcal', icon: Flame, value: report.totals.kcal },
              { label: 'Proteína', unit: 'g', icon: Beef, value: report.totals.protein_g },
              { label: 'Carboidrato', unit: 'g', icon: Wheat, value: report.totals.carbs_g },
              { label: 'Gordura', unit: 'g', icon: Droplets, value: report.totals.fat_g },
              { label: 'Volume de treino', unit: 'kg', icon: Dumbbell, value: report.totals.volume_kg },
            ].map(({ label, unit, icon: Icon, value }) => (
              <div className="tile" key={label}>
                <div className="tile-head">
                  <span className="tile-label">{label}</span>
                  <span className="tile-icon">
                    <Icon size={14} aria-hidden />
                  </span>
                </div>
                <span className="tile-value">{value}</span>
                <span className="tile-unit">{unit}</span>
              </div>
            ))}
          </div>

          <h3>Refeições</h3>
          {report.meals.length === 0 ? (
            <p className="empty">Nenhuma refeição registrada neste dia.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Alimento</th>
                  <th>Qtd (g)</th>
                  <th>kcal</th>
                  <th>P (g)</th>
                  <th>C (g)</th>
                  <th>G (g)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {report.meals.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.grams}</td>
                    <td>{m.kcal}</td>
                    <td>{m.protein_g}</td>
                    <td>{m.carbs_g}</td>
                    <td>{m.fat_g}</td>
                    <td>
                      <button
                        aria-label={`remover ${m.name}`}
                        onClick={() => void run(() => deleteMeal(m.id))}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form className="add-form" onSubmit={submitMeal}>
            <select aria-label="alimento" value={foodId} onChange={(e) => setFoodId(e.target.value)}>
              <option value="">alimento…</option>
              {foods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <input
              aria-label="gramas"
              type="number"
              min="1"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
            />
            <button aria-label="adicionar refeição" disabled={!foodId}>
              <Plus size={16} aria-hidden />
              Adicionar
            </button>
          </form>

          <h3>Treino</h3>
          {report.sets.length === 0 ? (
            <p className="empty">Nenhuma série registrada neste dia.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Exercício</th>
                  <th>Séries</th>
                  <th>Reps</th>
                  <th>Carga (kg)</th>
                  <th>Volume (kg)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {report.sets.map((s) => (
                  <tr key={s.id}>
                    <td>{s.exercise}</td>
                    <td>{s.sets}</td>
                    <td>{s.reps}</td>
                    <td>{s.weight_kg}</td>
                    <td>{s.volume_kg}</td>
                    <td>
                      <button
                        aria-label={`remover ${s.exercise}`}
                        onClick={() => void run(() => deleteSet(s.id))}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form className="add-form" onSubmit={submitSet}>
            <input
              aria-label="exercício"
              placeholder="exercício"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
            />
            <input
              aria-label="séries"
              type="number"
              min="1"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
            />
            <input
              aria-label="repetições"
              type="number"
              min="1"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
            <input
              aria-label="carga em kg"
              type="number"
              min="0"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <button aria-label="adicionar série" disabled={!exercise.trim()}>
              <Plus size={16} aria-hidden />
              Adicionar
            </button>
          </form>
        </>
      )}
    </section>
  )
}
