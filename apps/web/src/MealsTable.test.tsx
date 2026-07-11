import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MealsTable from './MealsTable'
import { FOODS, REPORT } from './__tests__/helpers'

function setup() {
  const onUpdate = vi.fn()
  const onDelete = vi.fn()
  render(
    <MealsTable meals={REPORT.meals} foods={FOODS} onUpdate={onUpdate} onDelete={onDelete} />,
  )
  return { onUpdate, onDelete }
}

describe('MealsTable', () => {
  it('mostra estado vazio sem refeições', () => {
    render(<MealsTable meals={[]} foods={FOODS} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/nenhuma refeição/i)).toBeTruthy()
  })

  it('remove pela lixeira', () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByLabelText('remover frango grelhado'))
    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('edita alimento e gramas', () => {
    const { onUpdate } = setup()
    fireEvent.click(screen.getByLabelText('editar frango grelhado'))
    const select = screen.getByLabelText('editar alimento') as HTMLSelectElement
    expect(select.value).toBe('1') // prefill com o alimento atual
    fireEvent.change(select, { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('editar gramas'), { target: { value: '250' } })
    fireEvent.click(screen.getByLabelText('salvar frango grelhado'))
    expect(onUpdate).toHaveBeenCalledWith(1, 12, 250, 'Almoço')
    expect(screen.queryByLabelText('editar gramas')).toBeNull() // saiu do modo edição
  })

  it('cancela a edição sem salvar', () => {
    const { onUpdate } = setup()
    fireEvent.click(screen.getByLabelText('editar whey protein'))
    fireEvent.click(screen.getByLabelText('cancelar edição'))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByRole('cell', { name: 'whey protein' })).toBeTruthy()
  })
})
