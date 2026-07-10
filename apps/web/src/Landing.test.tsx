import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Landing from './Landing'

describe('Landing', () => {
  it('mostra logo, título, subtítulo, descrição e os três cards', () => {
    render(<Landing onStart={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Marombas Tracker' })).toBeTruthy()
    expect(screen.getByText('Seu diário inteligente de treino e alimentação.')).toBeTruthy()
    expect(screen.getByText(/tabela TACO/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Chat Inteligente' })).toBeTruthy()
    expect(screen.getByText(/linguagem natural/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Diário' })).toBeTruthy()
    expect(screen.getByText(/calorias, macros e volume/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Evolução' })).toBeTruthy()
    expect(screen.getByText(/veja gráficos/i)).toBeTruthy()
  })

  it('chama onStart ao clicar em Vamos começar', () => {
    const onStart = vi.fn()
    render(<Landing onStart={onStart} />)
    fireEvent.click(screen.getByRole('button', { name: /vamos começar/i }))
    expect(onStart).toHaveBeenCalledOnce()
  })
})
