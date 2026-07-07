import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Chat from './Chat'
import { mockFetch } from './__tests__/helpers'

const REPLY = { reply: 'Registrado em 2026-07-06:\nRefeições…', meals_logged: 1, sets_logged: 0, unmatched: [] }

function send(text: string) {
  fireEvent.change(screen.getByLabelText('mensagem'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
}

describe('Chat', () => {
  it('mostra a dica quando não há mensagens', () => {
    mockFetch({})
    render(<Chat day="2026-07-06" />)
    expect(screen.getByText(/descreva sua dieta/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('envia a mensagem e mostra a resposta mock', async () => {
    const fn = mockFetch({ 'POST /api/chat': REPLY })
    render(<Chat day="2026-07-06" />)
    send('comi 200g de frango')
    expect(screen.getByText('comi 200g de frango')).toBeTruthy()
    expect(await screen.findByText(/registrado em 2026-07-06/i)).toBeTruthy()
    const body = JSON.parse((fn.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ day: '2026-07-06', message: 'comi 200g de frango' })
  })

  it('desabilita o botão enquanto envia', async () => {
    let resolve!: (v: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((r) => (resolve = r))),
    )
    render(<Chat day="2026-07-06" />)
    send('teste')
    fireEvent.change(screen.getByLabelText('mensagem'), { target: { value: 'outra' } })
    expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(true)
    resolve(new Response(JSON.stringify(REPLY), { status: 200 }))
    expect(await screen.findByText(/registrado em/i)).toBeTruthy()
  })

  it('mostra erro amigável quando a API está fora', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    render(<Chat day="2026-07-06" />)
    send('oi')
    expect(await screen.findByText(/erro ao falar com a api/i)).toBeTruthy()
  })
})
