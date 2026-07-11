import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Beef,
  Check,
  ChevronDown,
  Droplets,
  Dumbbell,
  Flame,
  Gauge,
  GlassWater,
  Plus,
  Target,
  Wheat,
} from 'lucide-react'
import {
  addMeal,
  addSet,
  addWater,
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
import { MEAL_TYPES } from './types'
import type { Food, Goals, MealType, Report } from './types'

export default function Diario({ day }: { day: string }) {
  const [report, setReport] = useState<Report | null>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [goals, setGoals] = useState<Goals | null>(null)
  const [error, setError] = useState('')
  const [foodId, setFoodId] = useState('')
  const [grams, setGrams] = useState('100')
  const [mealType, setMealType] = useState<MealType>('Almoço')
  const [exercise, setExercise] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [weight, setWeight] = useState('20')
  const [editingGoals, setEditingGoals] = useState(false)
  const [goalKcal, setGoalKcal] = useState('')
  const [goalProtein, setGoalProtein] = useState('')
  const [goalWater, setGoalWater] = useState('')
  const [goalCarbs, setGoalCarbs] = useState('')
  const [goalFat, setGoalFat] = useState('')

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
    void run(() => addMeal(day, Number(foodId), Number(grams), mealType))
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
    setGoalWater(String(current.water_ml))
    setGoalCarbs(String(current.carbs_g))
    setGoalFat(String(current.fat_g))
    setEditingGoals(true)
  }

  function submitGoals(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      await putGoals({
        kcal: Number(goalKcal),
        protein_g: Number(goalProtein),
        water_ml: Number(goalWater),
        carbs_g: Number(goalCarbs),
        fat_g: Number(goalFat),
      })
      setGoals(await getGoals())
      setEditingGoals(false)
    })
  }

  const liters = (ml: number) => Number((ml / 1000).toFixed(1))

  const tiles = report && [
    { label: 'Calorias', unit: 'kcal', icon: Flame, value: report.totals.kcal, goal: goals?.kcal },
    {
      label: 'Proteína',
      unit: 'g',
      icon: Beef,
      value: report.totals.protein_g,
      goal: goals?.protein_g,
    },
    {
      label: 'Carboidrato',
      unit: 'g',
      icon: Wheat,
      value: report.totals.carbs_g,
      goal: goals?.carbs_g,
    },
    { label: 'Gordura', unit: 'g', icon: Droplets, value: report.totals.fat_g, goal: goals?.fat_g },
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
                      {value} / {goal} {unit}
                    </span>
                  </>
                )}
              </div>
            ))}
            {goals && (
              <div className="tile">
                <div className="tile-head">
                  <span className="tile-label">Calorias restantes</span>
                  <span className="tile-icon">
                    <Gauge size={14} aria-hidden />
                  </span>
                </div>
                {(() => {
                  const remaining = Math.round((goals.kcal - report.totals.kcal) * 10) / 10
                  return (
                    <>
                      <span className={`tile-value${remaining < 0 ? ' over' : ''}`}>
                        {remaining}
                      </span>
                      <span className="tile-unit">
                        {remaining < 0 ? 'kcal acima da meta' : 'kcal disponíveis'}
                      </span>
                    </>
                  )
                })()}
              </div>
            )}
            <div className="tile">
              <div className="tile-head">
                <span className="tile-label">Água</span>
                <span className="tile-icon">
                  <GlassWater size={14} aria-hidden />
                </span>
              </div>
              <span className="tile-value">
                {liters(report.totals.water_ml)}L{goals && ` / ${liters(goals.water_ml)}L`}
              </span>
              <span className="tile-unit">hoje</span>
              {goals && (
                <div
                  className="progress"
                  role="progressbar"
                  aria-label="progresso de água"
                  aria-valuemin={0}
                  aria-valuemax={goals.water_ml}
                  aria-valuenow={Math.min(report.totals.water_ml, goals.water_ml)}
                >
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, (report.totals.water_ml / goals.water_ml) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <div className="water-actions">
                {[250, 500, 1000].map((ml) => (
                  <button key={ml} onClick={() => void run(() => addWater(day, ml))}>
                    +{ml === 1000 ? '1L' : `${ml}ml`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {goals && !editingGoals && (
            <button className="ghost" aria-label="editar metas" onClick={() => openGoals(goals)}>
              <Target size={14} aria-hidden />
              Editar metas
            </button>
          )}
          {editingGoals && (
            <form className="add-form goals-form" onSubmit={submitGoals}>
              <label className="field">
                kcal
                <input
                  aria-label="meta de calorias"
                  type="number"
                  min="1"
                  value={goalKcal}
                  onChange={(e) => setGoalKcal(e.target.value)}
                />
              </label>
              <label className="field">
                proteína (g)
                <input
                  aria-label="meta de proteína"
                  type="number"
                  min="1"
                  value={goalProtein}
                  onChange={(e) => setGoalProtein(e.target.value)}
                />
              </label>
              <label className="field">
                carboidrato (g)
                <input
                  aria-label="meta de carboidrato"
                  type="number"
                  min="1"
                  value={goalCarbs}
                  onChange={(e) => setGoalCarbs(e.target.value)}
                />
              </label>
              <label className="field">
                gordura (g)
                <input
                  aria-label="meta de gordura"
                  type="number"
                  min="1"
                  value={goalFat}
                  onChange={(e) => setGoalFat(e.target.value)}
                />
              </label>
              <label className="field">
                água (ml)
                <input
                  aria-label="meta de água em ml"
                  type="number"
                  min="1"
                  value={goalWater}
                  onChange={(e) => setGoalWater(e.target.value)}
                />
              </label>
              <button aria-label="salvar metas">
                <Check size={16} aria-hidden />
                Salvar metas
              </button>
            </form>
          )}

          <h3>Refeições</h3>
          {report.meals.length === 0 ? (
            <p className="empty">Nenhuma refeição registrada neste dia.</p>
          ) : (
            MEAL_TYPES.filter((t) => report.meals.some((m) => m.meal_type === t)).map((t) => {
              const group = report.meals.filter((m) => m.meal_type === t)
              const sum = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') =>
                Math.round(group.reduce((acc, m) => acc + m[key], 0) * 10) / 10
              return (
                <details key={t} className="meal-group" open>
                  <summary>
                    <span className="meal-name">
                      <ChevronDown size={14} className="chev" aria-hidden />
                      {t}
                    </span>
                    <span className="meal-totals">
                      {sum('kcal')} kcal · P {sum('protein_g')}g · C {sum('carbs_g')}g · G{' '}
                      {sum('fat_g')}g
                    </span>
                  </summary>
                  <MealsTable
                    meals={group}
                    foods={foods}
                    onUpdate={(id, food_id, mealGrams, type) =>
                      void run(() => updateMeal(id, food_id, mealGrams, type))
                    }
                    onDelete={(id) => void run(() => deleteMeal(id))}
                  />
                </details>
              )
            })
          )}
          <form className="add-form" onSubmit={submitMeal}>
            <select
              aria-label="refeição do dia"
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
            >
              {MEAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
