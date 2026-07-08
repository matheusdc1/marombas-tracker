import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import type { Food, MealRow } from './types'

interface Props {
  meals: MealRow[]
  foods: Food[]
  onUpdate: (id: number, food_id: number, grams: number) => void
  onDelete: (id: number) => void
}

export default function MealsTable({ meals, foods, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const [foodId, setFoodId] = useState('')
  const [grams, setGrams] = useState('')

  function startEdit(meal: MealRow) {
    setEditing(meal.id)
    setFoodId(String(meal.food_id))
    setGrams(String(meal.grams))
  }

  function save(id: number) {
    onUpdate(id, Number(foodId), Number(grams))
    setEditing(null)
  }

  if (meals.length === 0) {
    return <p className="empty">Nenhuma refeição registrada neste dia.</p>
  }

  return (
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
        {meals.map((m) =>
          m.id === editing ? (
            <tr key={m.id} className="editing">
              <td>
                <select
                  aria-label="editar alimento"
                  value={foodId}
                  onChange={(e) => setFoodId(e.target.value)}
                >
                  {foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  aria-label="editar gramas"
                  type="number"
                  min="1"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                />
              </td>
              <td colSpan={5} className="row-actions">
                <button aria-label={`salvar ${m.name}`} onClick={() => save(m.id)}>
                  <Check size={14} aria-hidden />
                </button>
                <button aria-label="cancelar edição" onClick={() => setEditing(null)}>
                  <X size={14} aria-hidden />
                </button>
              </td>
            </tr>
          ) : (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.grams}</td>
              <td>{m.kcal}</td>
              <td>{m.protein_g}</td>
              <td>{m.carbs_g}</td>
              <td>{m.fat_g}</td>
              <td className="row-actions">
                <button aria-label={`editar ${m.name}`} onClick={() => startEdit(m)}>
                  <Pencil size={14} aria-hidden />
                </button>
                <button aria-label={`remover ${m.name}`} onClick={() => onDelete(m.id)}>
                  <Trash2 size={14} aria-hidden />
                </button>
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  )
}
