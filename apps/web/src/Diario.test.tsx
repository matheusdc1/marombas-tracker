import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Diario from './Diario'
import { EMPTY_REPORT, FOODS, REPORT, mockFetch } from './__tests__/helpers'

describe('Diario', () => {
  it('mostra loading e depois o relatório com refeições e treino', async () => {
    mockFetch({ 'GET /api/foods': FOODS, 'GET /api/log': REPORT })
    render(<Diario day="2026-07-06" />)
    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(await screen.findByRole('cell', { name: 'frango grelhado' })).toBeTruthy()
    expect(screen.getByText('438')).toBeTruthy() // kcal total
    expect(screen.getByText('supino reto')).toBeTruthy()
    expect(screen.getByText('1200')).toBeTruthy() // volume da série
  })

  it('mostra estados vazios num dia sem registros', async () => {
    mockFetch({ 'GET /api/foods': FOODS, 'GET /api/log': EMPTY_REPORT })
    render(<Diario day="2026-07-05" />)
    expect(await screen.findByText(/nenhuma refeição registrada/i)).toBeTruthy()
    expect(screen.getByText(/nenhuma série registrada/i)).toBeTruthy()
  })

  it('adiciona refeição pelo formulário', async () => {
    const fn = mockFetch({
      'GET /api/foods': FOODS,
      'GET /api/log': REPORT,
      'POST /api/log/2026-07-06/meals': { id: 9 },
    })
    render(<Diario day="2026-07-06" />)
    await screen.findByRole('cell', { name: 'frango grelhado' })
    fireEvent.change(screen.getByLabelText('alimento'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('gramas'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: '+ refeição' }))
    await screen.findByRole('cell', { name: 'frango grelhado' })
    const post = fn.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!
    expect(post[0]).toBe('/api/log/2026-07-06/meals')
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ food_id: 12, grams: 40 })
  })

  it('adiciona série pelo formulário', async () => {
    const fn = mockFetch({
      'GET /api/foods': FOODS,
      'GET /api/log': REPORT,
      'POST /api/log/2026-07-06/sets': { id: 9 },
    })
    render(<Diario day="2026-07-06" />)
    await screen.findByText('supino reto')
    expect((screen.getByRole('button', { name: '+ série' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('exercício'), { target: { value: 'remada curvada' } })
    fireEvent.change(screen.getByLabelText('séries'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('repetições'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('carga em kg'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: '+ série' }))
    await screen.findByText('supino reto')
    const post = fn.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!
    expect(post[0]).toBe('/api/log/2026-07-06/sets')
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
      exercise: 'remada curvada',
      sets: 4,
      reps: 8,
      weight_kg: 50,
    })
  })

  it('remove refeição e série', async () => {
    const fn = mockFetch({
      'GET /api/foods': FOODS,
      'GET /api/log': REPORT,
      'DELETE /api/meals/1': { ok: true },
      'DELETE /api/sets/1': { ok: true },
    })
    render(<Diario day="2026-07-06" />)
    fireEvent.click(await screen.findByLabelText('remover frango grelhado'))
    fireEvent.click(await screen.findByLabelText('remover supino reto'))
    await screen.findByRole('cell', { name: 'frango grelhado' })
    const urls = fn.mock.calls.map(([url]) => url)
    expect(urls).toContain('/api/meals/1')
    expect(urls).toContain('/api/sets/1')
  })

  it('mostra erro quando a API está fora', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    render(<Diario day="2026-07-06" />)
    expect(await screen.findByText(/falha ao falar com a api/i)).toBeTruthy()
  })

  it('mostra erro quando uma remoção falha, sem perder o relatório', async () => {
    mockFetch({ 'GET /api/foods': FOODS, 'GET /api/log': REPORT }) // sem rota DELETE -> 404
    render(<Diario day="2026-07-06" />)
    fireEvent.click(await screen.findByLabelText('remover frango grelhado'))
    expect(await screen.findByText(/falha ao falar com a api/i)).toBeTruthy()
  })
})
