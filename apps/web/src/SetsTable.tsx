import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import type { SetRow } from './types'

interface SetData {
  exercise: string
  sets: number
  reps: number
  weight_kg: number
}

interface Props {
  sets: SetRow[]
  onUpdate: (id: number, data: SetData) => void
  onDelete: (id: number) => void
}

export default function SetsTable({ sets, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState({ exercise: '', sets: '', reps: '', weight: '' })

  function startEdit(row: SetRow) {
    setEditing(row.id)
    setForm({
      exercise: row.exercise,
      sets: String(row.sets),
      reps: String(row.reps),
      weight: String(row.weight_kg),
    })
  }

  function save(id: number) {
    onUpdate(id, {
      exercise: form.exercise,
      sets: Number(form.sets),
      reps: Number(form.reps),
      weight_kg: Number(form.weight),
    })
    setEditing(null)
  }

  if (sets.length === 0) {
    return <p className="empty">Nenhuma série registrada neste dia.</p>
  }

  return (
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
        {sets.map((s) =>
          s.id === editing ? (
            <tr key={s.id} className="editing">
              <td>
                <input
                  aria-label="editar exercício"
                  value={form.exercise}
                  onChange={(e) => setForm({ ...form, exercise: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="editar séries"
                  type="number"
                  min="1"
                  value={form.sets}
                  onChange={(e) => setForm({ ...form, sets: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="editar repetições"
                  type="number"
                  min="1"
                  value={form.reps}
                  onChange={(e) => setForm({ ...form, reps: e.target.value })}
                />
              </td>
              <td>
                <input
                  aria-label="editar carga"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </td>
              <td colSpan={2} className="row-actions">
                <button aria-label={`salvar ${s.exercise}`} onClick={() => save(s.id)}>
                  <Check size={14} aria-hidden />
                </button>
                <button aria-label="cancelar edição" onClick={() => setEditing(null)}>
                  <X size={14} aria-hidden />
                </button>
              </td>
            </tr>
          ) : (
            <tr key={s.id}>
              <td>{s.exercise}</td>
              <td>{s.sets}</td>
              <td>{s.reps}</td>
              <td>{s.weight_kg}</td>
              <td>{s.volume_kg}</td>
              <td className="row-actions">
                <button aria-label={`editar ${s.exercise}`} onClick={() => startEdit(s)}>
                  <Pencil size={14} aria-hidden />
                </button>
                <button aria-label={`remover ${s.exercise}`} onClick={() => onDelete(s.id)}>
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
