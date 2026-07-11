import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Evolucao from './Evolucao'
import { EXERCISES, METRICS, PRS, mockFetch } from './__tests__/helpers'

const ROUTES = {
  'GET /api/metrics': METRICS,
  'GET /api/exercises': EXERCISES,
  'GET /api/prs': PRS,
}

describe('Evolucao', () => {
  it('mostra tiles, gráfico, filtros e histórico de PRs', async () => {
    mockFetch(ROUTES)
    render(<Evolucao />)
    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(await screen.findByRole('img')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy() // registros no período
    expect(screen.getAllByText('1340').length).toBeGreaterThan(0) // máximo (tile e tabela)
    expect(screen.getByLabelText('métrica')).toBeTruthy()
    expect(screen.getByLabelText('período')).toBeTruthy()
    expect(screen.queryByLabelText('exercício')).toBeNull() // só na métrica de exercício
    expect(screen.getByText(/histórico de prs \(1\)/i)).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'supino reto' })).toBeTruthy()
  })

  it('filtra por período e por exercício', async () => {
    const fn = mockFetch(ROUTES)
    render(<Evolucao />)
    await screen.findByRole('img')
    fireEvent.change(screen.getByLabelText('período'), { target: { value: '7' } })
    await screen.findByRole('img')
    expect(fn.mock.calls.some(([url]) => (url as string).includes('days=7'))).toBe(true)
    fireEvent.change(screen.getByLabelText('métrica'), { target: { value: 'exercicio' } })
    await screen.findByLabelText('exercício')
    expect(
      fn.mock.calls.some(([url]) =>
        (url as string).includes('metric=exercicio&days=7&exercise=agachamento'),
      ),
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('exercício'), { target: { value: 'supino reto' } })
    await screen.findByRole('img')
    expect(
      fn.mock.calls.some(([url]) => (url as string).includes('exercise=supino%20reto')),
    ).toBe(true)
  })

  it('na métrica de peso mostra inicial, atual, diferença e registra peso', async () => {
    const weightMetrics = {
      unit: 'kg',
      points: [
        { day: '2026-07-01', value: 83 },
        { day: '2026-07-07', value: 82.4 },
      ],
    }
    const fn = mockFetch({
      ...ROUTES,
      'GET /api/metrics': weightMetrics,
      'POST /api/weight': { id: 1 },
    })
    render(<Evolucao />)
    await screen.findByRole('img')
    fireEvent.change(screen.getByLabelText('métrica'), { target: { value: 'peso' } })
    expect(await screen.findByText('Peso inicial')).toBeTruthy()
    expect(screen.getAllByText('83').length).toBeGreaterThan(0)
    expect(screen.getAllByText('82.4').length).toBeGreaterThan(0)
    expect(screen.getByText('-0.6')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('peso em kg'), { target: { value: '82.1' } })
    fireEvent.click(screen.getByLabelText('registrar peso'))
    await screen.findByText('Peso inicial')
    const post = fn.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )!
    expect(post[0]).toBe('/api/weight')
    expect(JSON.parse((post[1] as RequestInit).body as string)).toMatchObject({ kg: 82.1 })
  })

  it('mostra diferença positiva com sinal de mais', async () => {
    mockFetch({
      ...ROUTES,
      'GET /api/metrics': {
        unit: 'kg',
        points: [
          { day: '2026-07-01', value: 80 },
          { day: '2026-07-07', value: 81.5 },
        ],
      },
    })
    render(<Evolucao />)
    await screen.findByRole('img')
    fireEvent.change(screen.getByLabelText('métrica'), { target: { value: 'peso' } })
    expect(await screen.findByText('+1.5')).toBeTruthy()
  })

  it('mostra estado vazio sem registros e sem PRs', async () => {
    mockFetch({
      'GET /api/metrics': { unit: 'kg', points: [] },
      'GET /api/exercises': [],
      'GET /api/prs': [],
    })
    render(<Evolucao />)
    expect(await screen.findByText(/sem registros neste período/i)).toBeTruthy()
    expect(screen.getByText(/nenhum pr registrado/i)).toBeTruthy()
  })

  it('mostra erro quando a API está fora', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    render(<Evolucao />)
    expect(await screen.findByText(/não consegui carregar/i)).toBeTruthy()
  })
})
