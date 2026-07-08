import { vi } from 'vitest'
import type { Food, Goals, Progress, Report } from '../types'

export const REPORT: Report = {
  day: '2026-07-06',
  meals: [
    {
      id: 1,
      food_id: 1,
      name: 'frango grelhado',
      grams: 200,
      kcal: 318,
      protein_g: 64,
      carbs_g: 0,
      fat_g: 5,
    },
    {
      id: 2,
      food_id: 12,
      name: 'whey protein',
      grams: 30,
      kcal: 120,
      protein_g: 24,
      carbs_g: 3,
      fat_g: 1.8,
    },
  ],
  sets: [{ id: 1, exercise: 'supino reto', sets: 2, reps: 10, weight_kg: 60, volume_kg: 1200 }],
  totals: { kcal: 438, protein_g: 88, carbs_g: 3, fat_g: 6.8, volume_kg: 1200 },
}

export const GOALS: Goals = { kcal: 2500, protein_g: 150 }

export const EMPTY_REPORT: Report = {
  day: '2026-07-05',
  meals: [],
  sets: [],
  totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, volume_kg: 0 },
}

export const PROGRESS: Progress = {
  exercises: ['agachamento', 'supino reto'],
  points: [
    { day: '2026-07-01', volume_kg: 1000 },
    { day: '2026-07-02', volume_kg: 1100 },
    { day: '2026-07-03', volume_kg: 1150 },
    { day: '2026-07-04', volume_kg: 1200 },
    { day: '2026-07-05', volume_kg: 1250 },
    { day: '2026-07-06', volume_kg: 1300 },
    { day: '2026-07-07', volume_kg: 1340 },
  ],
}

export const FOODS: Food[] = [
  { id: 1, name: 'frango grelhado', kcal: 159, protein_g: 32, carbs_g: 0, fat_g: 2.5 },
  { id: 12, name: 'whey protein', kcal: 400, protein_g: 80, carbs_g: 10, fat_g: 6 },
]

/** Stub do fetch por rota: chaves "METODO /prefixo/da/url" -> corpo JSON. */
export function mockFetch(routes: Record<string, unknown>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const hit = Object.entries(routes).find(([key]) => {
      const [m, prefix] = key.split(' ')
      return m === method && url.startsWith(prefix)
    })
    if (!hit) return new Response('{"detail":"not found"}', { status: 404 })
    return new Response(JSON.stringify(hit[1]), { status: 200 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
