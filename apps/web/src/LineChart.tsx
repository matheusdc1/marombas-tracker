import { useState } from 'react'
import type { PointerEvent } from 'react'
import type { ProgressPoint } from './types'

const W = 640
const H = 280
const PAD = { left: 56, right: 16, top: 16, bottom: 36 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function niceStep(rough: number): number {
  const pow = 10 ** Math.floor(Math.log10(rough))
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((c) => c >= rough)!
}

export default function LineChart({ points }: { points: ProgressPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const yMax = Math.max(...points.map((p) => p.volume_kg), 1)
  const step = niceStep(yMax / 4)
  const yTop = step * Math.ceil(yMax / step)
  const ticks = Array.from({ length: Math.round(yTop / step) + 1 }, (_, i) => i * step)
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? INNER_W / 2 : (i * INNER_W) / (points.length - 1))
  const y = (v: number) => PAD.top + INNER_H - (v / yTop) * INNER_H
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.volume_kg)}`).join(' ')

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const vx = ((e.clientX - rect.left) / rect.width) * W
    let nearest = 0
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(i) - vx) < Math.abs(x(nearest) - vx)) nearest = i
    }
    setHover(nearest)
  }

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Evolução do volume total de treino por dia, em quilos"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? 'baseline' : 'grid'}
            />
            <text x={PAD.left - 8} y={y(t) + 4} className="tick" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.day} x={x(i)} y={H - PAD.bottom + 20} className="tick" textAnchor="middle">
              {p.day.slice(5)}
            </text>
          ) : null,
        )}
        {hover != null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            className="crosshair"
          />
        )}
        <path d={path} className="series-line" fill="none" />
        {points.map((p, i) => (
          <circle
            key={p.day}
            cx={x(i)}
            cy={y(p.volume_kg)}
            r={hover === i ? 6 : 4}
            className="series-dot"
          />
        ))}
      </svg>
      {hover != null && (
        <figcaption className="tooltip" role="status">
          {points[hover].day}: {points[hover].volume_kg} kg
        </figcaption>
      )}
      <details>
        <summary>Ver dados em tabela</summary>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Volume (kg)</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <td>{p.day}</td>
                <td>{p.volume_kg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
