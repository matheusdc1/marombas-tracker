import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Beef, Check, Droplets, Dumbbell, Flame, Plus, Target, Wheat } from 'lucide-react'
import {
  addMeal,
  addSet,
  deleteMeal,
  deleteSet,
  getFoods,
  getGoals,
  getReport,
  putGoals,
  updateMeal,
  updateSet,
} from './api'
import MealsTable from './MealsTable'
import SetsTable from './SetsTable'
import type { Food, Goals, Report } from './types'

export default function Diario({ day }: { day: string }) {
  const [report, setReport] = useState<Report | null>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [goals, setGoals] = useState<Goals | null>(null)
  const [error, setError] = useState('')
  const [foodId, setFoodId] = useState('')
  const [grams, setGrams] = useState('100')
  const [exercise, setExercise] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [weight, setWeight] = useState('20')
  const [editingGoals, setEditingGoals] = useState(false)
  const [goalKcal, setGoalKcal] = useState('')
  const [goalProtein, setGoalProtein] = useState('')

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
    getGoals().then(setGoals).catch(() => setGoals(null))
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

  function openGoals(current: Goals) {
    setGoalKcal(String(current.kcal))
    setGoalProtein(String(current.protein_g))
    setEditingGoals(true)
  }

  function submitGoals(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      await putGoals({ kcal: Number(goalKcal), protein_g: Number(goalProtein) })
      setGoals(await getGoals())
      setEditingGoals(false)
    })
  }

  const tiles = report && [
    { label: 'Calorias', unit: 'kcal', icon: Flame, value: report.totals.kcal, goal: goals?.kcal },
    {
      label: 'Proteína',
      unit: 'g',
      icon: Beef,
      value: report.totals.protein_g,
      goal: goals?.protein_g,
    },
    { label: 'Carboidrato', unit: 'g', icon: Wheat, value: report.totals.carbs_g },
    { label: 'Gordura', unit: 'g', icon: Droplets, value: report.totals.fat_g },
    { label: 'Volume de treino', unit: 'kg', icon: Dumbbell, value: report.totals.volume_kg },
  ]

  return (
    <section className="diario">
      <h2>Diário de {day}</h2>
      <p className="muted">Totais do dia, refeições e treino — edite à vontade.</p>
      {error && <p className="error">{error}</p>}
      {!report && !error && <p>Carregando…</p>}
      {report && tiles && (
        <>
          <div className="tiles">
            {tiles.map(({ label, unit, icon: Icon, value, goal }) => (
              <div className="tile" key={label}>
                <div className="tile-head">
                  <span className="tile-label">{label}</span>
                  <span className="tile-icon">
                    <Icon size={14} aria-hidden />
                  </span>
                </div>
                <span className="tile-value">{value}</span>
                <span className="tile-unit">{unit}</span>
                {goal != null && (
                  <>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-label={`progresso de ${label}`}
                      aria-valuemin={0}
                      aria-valuemax={goal}
                      aria-valuenow={Math.min(value, goal)}
                    >
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, (value / goal) * 100)}%` }}
                      />
                    </div>
                    <span className="tile-goal">
                      meta: {goal} {unit}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          {goals && !editingGoals && (
            <button className="ghost" aria-label="editar metas" onClick={() => openGoals(goals)}>
              <Target size={14} aria-hidden />
              Editar metas
            </button>
          )}
          {editingGoals && (
            <form className="add-form" onSubmit={submitGoals}>
              <input
                aria-label="meta de calorias"
                type="number"
                min="1"
                value={goalKcal}
                onChange={(e) => setGoalKcal(e.target.value)}
              />
              <input
                aria-label="meta de proteína"
                type="number"
                min="1"
                value={goalProtein}
                onChange={(e) => setGoalProtein(e.target.value)}
              />
              <button aria-label="salvar metas">
                <Check size={16} aria-hidden />
                Salvar metas
              </button>
            </form>
          )}

          <h3>Refeições</h3>
          <MealsTable
            meals={report.meals}
            foods={foods}
            onUpdate={(id, food_id, mealGrams) => void run(() => updateMeal(id, food_id, mealGrams))}
            onDelete={(id) => void run(() => deleteMeal(id))}
          />
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
          <SetsTable
            sets={report.sets}
            onUpdate={(id, data) => void run(() => updateSet(id, data))}
            onDelete={(id) => void run(() => deleteSet(id))}
          />
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
