import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Fotos from './Fotos'
import { PHOTOS, mockFetch } from './__tests__/helpers'

const ROUTES = { 'GET /api/photos': PHOTOS }

describe('Fotos', () => {
  it('mostra a linha do tempo agrupada por dia', async () => {
    mockFetch(ROUTES)
    render(<Fotos />)
    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: '2026-07-07' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '2026-07-01' })).toBeTruthy()
    expect(screen.getAllByRole('figure')).toHaveLength(3)
    expect(screen.getAllByText('Frente')).toHaveLength(3) // 2 cards + a option do select
  })

  it('mostra estado vazio sem fotos', async () => {
    mockFetch({ 'GET /api/photos': [] })
    render(<Fotos />)
    expect(await screen.findByText(/nenhuma foto ainda/i)).toBeTruthy()
  })

  it('envia uma foto pelo formulário', async () => {
    const fn = mockFetch({
      ...ROUTES,
      'POST /api/photos': { id: 9, day: '2026-07-08', category: 'Frente', url: '/api/photos/file/n.png' },
    })
    render(<Fotos />)
    await screen.findByRole('heading', { name: '2026-07-07' })
    expect((screen.getByLabelText('enviar foto') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('data da foto'), { target: { value: '2026-07-08' } })
    fireEvent.change(screen.getByLabelText('categoria'), { target: { value: 'Costas' } })
    const file = new File(['img'], 'evolucao.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('arquivo da foto'), { target: { files: [file] } })
    fireEvent.click(screen.getByLabelText('enviar foto'))
    await screen.findByRole('heading', { name: '2026-07-07' })
    const post = fn.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )!
    const body = (post[1] as RequestInit).body as FormData
    expect(body.get('day')).toBe('2026-07-08')
    expect(body.get('category')).toBe('Costas')
    expect((body.get('file') as File).name).toBe('evolucao.png')
  })

  it('seleciona duas fotos para comparar e limpa a comparação', async () => {
    mockFetch(ROUTES)
    render(<Fotos />)
    await screen.findByRole('heading', { name: '2026-07-07' })
    fireEvent.click(screen.getByLabelText('comparar foto 1'))
    expect(screen.queryByLabelText('limpar comparação')).toBeNull() // uma só não compara
    fireEvent.click(screen.getByLabelText('comparar foto 3'))
    expect(screen.getByLabelText('limpar comparação')).toBeTruthy()
    // com duas selecionadas, clicar numa terceira é ignorado
    fireEvent.click(screen.getByLabelText('comparar foto 2'))
    const compare = document.querySelector('.compare')!
    expect(compare.querySelectorAll('img')).toHaveLength(2)
    // desselecionar tirando uma da dupla
    fireEvent.click(screen.getByLabelText('comparar foto 1'))
    expect(screen.queryByLabelText('limpar comparação')).toBeNull()
    fireEvent.click(screen.getByLabelText('comparar foto 1'))
    fireEvent.click(screen.getByLabelText('limpar comparação'))
    expect(document.querySelector('.compare')).toBeNull()
  })

  it('remove foto pela lixeira', async () => {
    const fn = mockFetch({ ...ROUTES, 'DELETE /api/photos/2': { ok: true } })
    render(<Fotos />)
    fireEvent.click(await screen.findByLabelText('remover foto 2'))
    await screen.findByRole('heading', { name: '2026-07-07' })
    expect(fn.mock.calls.some(([url]) => url === '/api/photos/2')).toBe(true)
  })

  it('mostra erro quando a API está fora', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    render(<Fotos />)
    expect(await screen.findByText(/não consegui carregar as fotos/i)).toBeTruthy()
  })
})
