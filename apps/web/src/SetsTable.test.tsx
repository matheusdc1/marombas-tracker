import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SetsTable from './SetsTable'
import type { SetRow } from './types'

const SETS: SetRow[] = [
  {
    id: 1,
    exercise: 'supino reto',
    sets: 2,
    reps: 10,
    weight_kg: 60,
    rest_s: 90,
    is_pr: 1,
    volume_kg: 1200,
  },
  {
    id: 2,
    exercise: 'remada curvada',
    sets: 3,
    reps: 8,
    weight_kg: 40,
    rest_s: null,
    is_pr: 0,
    volume_kg: 960,
  },
]

function setup() {
  const onUpdate = vi.fn()
  const onDelete = vi.fn()
  render(<SetsTable sets={SETS} onUpdate={onUpdate} onDelete={onDelete} />)
  return { onUpdate, onDelete }
}

describe('SetsTable', () => {
  it('mostra estado vazio sem séries', () => {
    render(<SetsTable sets={[]} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/nenhuma série/i)).toBeTruthy()
  })

  it('mostra descanso, badge de PR e traço quando não há descanso', () => {
    setup()
    expect(screen.getByText('90s')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getAllByText('Novo PR')).toHaveLength(1) // só a série com PR
  })

  it('remove pela lixeira', () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByLabelText('remover supino reto'))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('edita exercício, séries, reps, carga e descanso', () => {
    const { onUpdate } = setup()
    fireEvent.click(screen.getByLabelText('editar supino reto'))
    expect((screen.getByLabelText('editar descanso') as HTMLInputElement).value).toBe('90')
    fireEvent.change(screen.getByLabelText('editar exercício'), {
      target: { value: 'supino inclinado' },
    })
    fireEvent.change(screen.getByLabelText('editar séries'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('editar repetições'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('editar carga'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('editar descanso'), { target: { value: '120' } })
    fireEvent.click(screen.getByLabelText('salvar supino reto'))
    expect(onUpdate).toHaveBeenCalledWith(1, {
      exercise: 'supino inclinado',
      sets: 4,
      reps: 8,
      weight_kg: 50,
      rest_s: 120,
    })
  })

  it('salva sem descanso como nulo e cancela sem salvar', () => {
    const { onUpdate } = setup()
    fireEvent.click(screen.getByLabelText('editar remada curvada'))
    expect((screen.getByLabelText('editar descanso') as HTMLInputElement).value).toBe('')
    fireEvent.click(screen.getByLabelText('salvar remada curvada'))
    expect(onUpdate).toHaveBeenCalledWith(2, expect.objectContaining({ rest_s: null }))
    fireEvent.click(screen.getByLabelText('editar supino reto'))
    fireEvent.click(screen.getByLabelText('cancelar edição'))
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })
})
