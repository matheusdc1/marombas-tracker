import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SetsTable from './SetsTable'
import { REPORT } from './__tests__/helpers'

function setup() {
  const onUpdate = vi.fn()
  const onDelete = vi.fn()
  render(<SetsTable sets={REPORT.sets} onUpdate={onUpdate} onDelete={onDelete} />)
  return { onUpdate, onDelete }
}

describe('SetsTable', () => {
  it('mostra estado vazio sem séries', () => {
    render(<SetsTable sets={[]} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/nenhuma série/i)).toBeTruthy()
  })

  it('remove pela lixeira', () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByLabelText('remover supino reto'))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('edita exercício, séries, reps e carga', () => {
    const { onUpdate } = setup()
    fireEvent.click(screen.getByLabelText('editar supino reto'))
    expect((screen.getByLabelText('editar exercício') as HTMLInputElement).value).toBe(
      'supino reto',
    )
    fireEvent.change(screen.getByLabelText('editar exercício'), {
      target: { value: 'supino inclinado' },
    })
    fireEvent.change(screen.getByLabelText('editar séries'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('editar repetições'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('editar carga'), { target: { value: '50' } })
    fireEvent.click(screen.getByLabelText('salvar supino reto'))
    expect(onUpdate).toHaveBeenCalledWith(1, {
      exercise: 'supino inclinado',
      sets: 4,
      reps: 8,
      weight_kg: 50,
    })
  })

  it('cancela a edição sem salvar', () => {
    const { onUpdate } = setup()
    fireEvent.click(screen.getByLabelText('editar supino reto'))
    fireEvent.click(screen.getByLabelText('cancelar edição'))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByRole('cell', { name: 'supino reto' })).toBeTruthy()
  })
})
