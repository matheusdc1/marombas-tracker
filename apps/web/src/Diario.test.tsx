import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Diario from './Diario'
import { EMPTY_REPORT, FOODS, GOALS, REPORT, mockFetch } from './__tests__/helpers'

const ROUTES = { 'GET /api/foods': FOODS, 'GET /api/log': REPORT, 'GET /api/goals': GOALS }

describe('Diario', () => {
  it('mostra loading e depois o relatório com refeições e treino', async () => {
    mockFetch(ROUTES)
    render(<Diario day="2026-07-06" />)
    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(await screen.findByRole('cell', { name: 'frango grelhado' })).toBeTruthy()
    expect(screen.getByText('438')).toBeTruthy() // kcal total no tile
    expect(screen.getByText(/supino reto/)).toBeTruthy()
    expect(screen.getAllByText('1200').length).toBeGreaterThan(0) // volume no tile e na tabela
    expect(screen.getByText('1h12min')).toBeTruthy() // duração do treino
    expect(screen.getByText('Novo PR')).toBeTruthy() // badge na série
  })

  it('salva a duração do treino', async () => {
    const fn = mockFetch({ ...ROUTES, 'PUT /api/log/2026-07-06/workout': { ok: true } })
    render(<Diario day="2026-07-06" />)
    await screen.findByRole('cell', { name: 'frango grelhado' })
    expect(
      (screen.getByLabelText('salvar duração') as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('duração em minutos'), { target: { value: '45' } })
    fireEvent.click(screen.getByLabelText('salvar duração'))
    await screen.findByRole('cell', { name: 'frango grelhado' })
    const put = fn.mock.calls.find(([url]) => (url as string).includes('/workout'))!
    expect(JSON.parse((put[1] as RequestInit).body as string)).toEqual({ duration_min: 45 })
  })

  it('mostra barras de progresso das metas e permite editá-las', async () => {
    const fn = mockFetch({ ...ROUTES, 'PUT /api/goals': { ok: true } })
    render(<Diario day="2026-07-06" />)
    await screen.findByRole('cell', { name: 'frango grelhado' })
    expect(screen.getAllByRole('progressbar')).toHaveLength(5) // kcal, prot, carb, gord, água
    expect(screen.getByText('438 / 2500 kcal')).toBeTruthy()
    fireEvent.click(await screen.findByLabelText('editar metas'))
    fireEvent.change(screen.getByLabelText('meta de calorias'), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('meta de proteína'), { target: { value: '180' } })
    fireEvent.change(screen.getByLabelText('meta de carboidrato'), { target: { value: '310' } })
    fireEvent.change(screen.getByLabelText('meta de gordura'), { target: { value: '75' } })
    fireEvent.change(screen.getByLabelText('meta de água em ml'), { target: { value: '3500' } })
    fireEvent.click(screen.getByLabelText('salvar metas'))
    await screen.findByLabelText('editar metas') // formulário fechou
    const put = fn.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')!
    expect(put[0]).toBe('/api/goals')
    expect(JSON.parse((put[1] as RequestInit).body as string)).toEqual({
      kcal: 3000,
      protein_g: 180,
      water_ml: 3500,
      carbs_g: 310,
      fat_g: 75,
    })
  })

  it('agrupa as refeições por horário com totais por grupo', async () => {
    mockFetch(ROUTES)
    const { container } = render(<Diario day="2026-07-06" />)
    await screen.findByRole('cell', { name: 'frango grelhado' })
    const summaries = Array.from(container.querySelectorAll('.meal-group summary')).map(
      (s) => s.textContent,
    )
    expect(summaries).toHaveLength(2) // grupos vazios não aparecem
    expect(summaries[0]).toContain('Almoço')
    expect(summaries[0]).toContain('318 kcal · P 64g · C 0g · G 5g')
    expect(summaries[1]).toContain('Lanche')
    expect(summaries[1]).toContain('120 kcal · P 24g · C 3g · G 1.8g')
  })

  it('mostra a água do dia e registra pelos botões rápidos', async () => {
    const fn = mockFetch({ ...ROUTES, 'POST /api/log/2026-07-06/water': { id: 9 } })
    render(<Diario day="2026-07-06" />)
    await screen.findByRole('cell', { name: 'frango grelhado' })
    expect(screen.getByText('2.6L / 4L')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '+250ml' }))
    await screen.findByText('2.6L / 4L')
    fireEvent.click(screen.getByRole('button', { name: '+1L' }))
    await screen.findByText('2.6L / 4L')
    const posts = fn.mock.calls.filter(
      ([url, init]) =>
        (init as RequestInit | undefined)?.method === 'POST' && (url as string).includes('/water'),
    )
    expect(posts.map(([, init]) => JSON.parse((init as RequestInit).body as string))).toEqual([
      { ml: 250 },
      { ml: 1000 },
    ])
  })

  it('mostra calorias restantes, em vermelho quando estoura a meta', async () => {
    mockFetch(ROUTES)
    const { unmount } = render(<Diario day="2026-07-06" />)
    await screen.findByRole('cell', { name: 'frango grelhado' })
    const remaining = screen.getByText('2062') // 2500 - 438
    expect(remaining.className).not.toContain('over')
    expect(screen.getByText('kcal disponíveis')).toBeTruthy()
    unmount()
    // dia que passou da meta
    const over = { ...REPORT, totals: { ...REPORT.totals, kcal: 2700 } }
    mockFetch({ ...ROUTES, 'GET /api/log': over })
    render(<Diario day="2026-07-06" />)
    const negative = await screen.findByText('-200')
    expect(negative.className).toContain('over')
    expect(screen.getByText('kcal acima da meta')).toBeTruthy()
  })

  it('sem metas (endpoint fora) os tiles ficam sem barra', async () => {
    mockFetch({ 'GET /api/foods': FOODS, 'GET /api/log': REPORT }) // sem rota de goals -> 404
    render(<Diario day="2026-07-06" />)
    await screen.findByRole('cell', { name: 'frango grelhado' })
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByLabelText('editar metas')).toBeNull()
  })

  it('edita refeição e série de ponta a ponta', async () => {
    const fn = mockFetch({
      ...ROUTES,
      'PUT /api/meals/1': { ok: true },
      'PUT /api/sets/1': { ok: true },
    })
    render(<Diario day="2026-07-06" />)
    fireEvent.click(await screen.findByLabelText('editar frango grelhado'))
    fireEvent.change(screen.getByLabelText('editar gramas'), { target: { value: '250' } })
    fireEvent.click(screen.getByLabelText('salvar frango grelhado'))
    fireEvent.click(await screen.findByLabelText('editar supino reto'))
    fireEvent.change(screen.getByLabelText('editar carga'), { target: { value: '65' } })
    fireEvent.click(screen.getByLabelText('salvar supino reto'))
    await screen.findByLabelText('editar supino reto')
    const puts = fn.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    expect(puts.map(([url]) => url)).toEqual(['/api/meals/1', '/api/sets/1'])
    expect(JSON.parse((puts[0][1] as RequestInit).body as string)).toEqual({
      food_id: 1,
      grams: 250,
      meal_type: 'Almoço',
    })
    expect(JSON.parse((puts[1][1] as RequestInit).body as string)).toMatchObject({
      weight_kg: 65,
    })
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
    fireEvent.change(screen.getByLabelText('refeição do dia'), { target: { value: 'Jantar' } })
    fireEvent.change(screen.getByLabelText('alimento'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('gramas'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'adicionar refeição' }))
    await screen.findByRole('cell', { name: 'frango grelhado' })
    const post = fn.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!
    expect(post[0]).toBe('/api/log/2026-07-06/meals')
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
      food_id: 12,
      grams: 40,
      meal_type: 'Jantar',
    })
  })

  it('adiciona série pelo formulário', async () => {
    const fn = mockFetch({
      'GET /api/foods': FOODS,
      'GET /api/log': REPORT,
      'POST /api/log/2026-07-06/sets': { id: 9 },
    })
    render(<Diario day="2026-07-06" />)
    await screen.findByText(/supino reto/)
    expect(
      (screen.getByRole('button', { name: 'adicionar série' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('exercício'), { target: { value: 'remada curvada' } })
    fireEvent.change(screen.getByLabelText('séries'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('repetições'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('carga em kg'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'adicionar série' }))
    await screen.findByText(/supino reto/)
    const post = fn.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!
    expect(post[0]).toBe('/api/log/2026-07-06/sets')
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
      exercise: 'remada curvada',
      sets: 4,
      reps: 8,
      weight_kg: 50,
      rest_s: null,
    })
    // com descanso preenchido
    fireEvent.change(screen.getByLabelText('descanso em segundos'), { target: { value: '90' } })
    fireEvent.click(screen.getByRole('button', { name: 'adicionar série' }))
    await screen.findByText(/supino reto/)
    const posts = fn.mock.calls.filter(
      ([url, init]) =>
        (init as RequestInit | undefined)?.method === 'POST' && (url as string).includes('/sets'),
    )
    expect(JSON.parse((posts[1][1] as RequestInit).body as string)).toMatchObject({ rest_s: 90 })
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
