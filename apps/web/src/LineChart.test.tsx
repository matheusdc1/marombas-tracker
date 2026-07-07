import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LineChart from './LineChart'
import { PROGRESS } from './__tests__/helpers'

const RECT = {
  width: 640,
  height: 280,
  left: 0,
  top: 0,
  right: 640,
  bottom: 280,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect

// fireEvent.pointerMove do jsdom não carrega clientX; MouseEvent com type pointermove sim
const move = (svg: Element, clientX: number) =>
  fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, clientX }))

describe('LineChart', () => {
  it('desenha um ponto por dia e a tabela de dados', () => {
    const { container } = render(<LineChart points={PROGRESS.points} />)
    expect(container.querySelectorAll('circle')).toHaveLength(7)
    expect(container.querySelectorAll('path')).toHaveLength(1)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(7)
    expect(screen.getByRole('img')).toBeTruthy()
  })

  it('centraliza quando há um único dia', () => {
    const { container } = render(<LineChart points={[{ day: '2026-07-01', volume_kg: 500 }]} />)
    const circle = container.querySelector('circle')!
    expect(Number(circle.getAttribute('cx'))).toBeCloseTo(56 + 568 / 2)
  })

  it('mostra crosshair e tooltip no hover e limpa ao sair', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(RECT)
    const { container } = render(<LineChart points={PROGRESS.points} />)
    const svg = container.querySelector('svg')!
    move(svg, 56)
    expect(screen.getByRole('status').textContent).toContain('2026-07-01: 1000 kg')
    expect(container.querySelector('.crosshair')).toBeTruthy()
    move(svg, 640)
    expect(screen.getByRole('status').textContent).toContain('2026-07-07: 1340 kg')
    fireEvent.pointerOut(svg)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ignora hover quando o SVG ainda não tem tamanho (jsdom)', () => {
    const { container } = render(<LineChart points={PROGRESS.points} />)
    move(container.querySelector('svg')!, 100)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
