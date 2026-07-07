import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Evolucao from './Evolucao'
import { PROGRESS, mockFetch } from './__tests__/helpers'

describe('Evolucao', () => {
  it('mostra tiles, gráfico e filtro de exercício', async () => {
    mockFetch({ 'GET /api/progress': PROGRESS })
    render(<Evolucao />)
    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(await screen.findByRole('img')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy() // dias de treino
    expect(screen.getAllByText('1340').length).toBeGreaterThan(0) // recorde no tile e na tabela
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('refaz a busca ao filtrar por exercício', async () => {
    const fn = mockFetch({ 'GET /api/progress': PROGRESS })
    render(<Evolucao />)
    await screen.findByRole('img')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'agachamento' } })
    await screen.findByRole('img')
    expect(fn).toHaveBeenLastCalledWith('/api/progress?exercise=agachamento', undefined)
  })

  it('mostra estado vazio sem treinos', async () => {
    mockFetch({ 'GET /api/progress': { exercises: [], points: [] } })
    render(<Evolucao />)
    expect(await screen.findByText(/nenhum treino registrado/i)).toBeTruthy()
  })

  it('mostra erro quando a API está fora', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    render(<Evolucao />)
    expect(await screen.findByText(/não consegui carregar/i)).toBeTruthy()
  })
})
