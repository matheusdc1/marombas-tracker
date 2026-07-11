import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { EMPTY_REPORT, EXERCISES, FOODS, METRICS, PHOTOS, PRS, mockFetch } from './__tests__/helpers'

function setup() {
  mockFetch({
    'GET /api/foods': FOODS,
    'GET /api/log': EMPTY_REPORT,
    'GET /api/metrics': METRICS,
    'GET /api/exercises': EXERCISES,
    'GET /api/prs': PRS,
    'GET /api/photos': PHOTOS,
  })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /vamos começar/i }))
}

describe('App', () => {
  it('abre na landing e o botão leva para o chat', () => {
    mockFetch({})
    render(<App />)
    expect(screen.getByText('Seu diário inteligente de treino e alimentação.')).toBeTruthy()
    expect(screen.queryByText(/resposta simulada/i)).toBeNull() // app ainda não abriu
    fireEvent.click(screen.getByRole('button', { name: /vamos começar/i }))
    expect(screen.getByText(/resposta simulada/i)).toBeTruthy() // caiu no Chat
  })

  it('abre no chat e navega entre as abas', async () => {
    setup()
    expect(screen.getByText(/resposta simulada/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Diário' }))
    expect(await screen.findByText('Refeições')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Evolução' }))
    expect(await screen.findByRole('heading', { name: 'Evolução' })).toBeTruthy()
    // na Evolução não existe seletor de dia
    expect(screen.queryByLabelText('dia')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fotos' }))
    expect(await screen.findByRole('heading', { name: 'Fotos de evolução' })).toBeTruthy()
    expect(screen.queryByLabelText('dia')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }))
    expect(screen.getByText(/resposta simulada/i)).toBeTruthy()
  })

  it('navega entre dias com as setas e o input de data', () => {
    setup()
    const input = screen.getByLabelText('dia') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2026-07-06' } })
    expect(input.value).toBe('2026-07-06')
    fireEvent.click(screen.getByLabelText('dia anterior'))
    expect(input.value).toBe('2026-07-05')
    fireEvent.click(screen.getByLabelText('próximo dia'))
    fireEvent.click(screen.getByLabelText('próximo dia'))
    expect(input.value).toBe('2026-07-07')
    // limpar o input não muda o dia selecionado
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByLabelText('dia')).toBeTruthy()
  })
})
