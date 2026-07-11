import { vi } from 'vitest'
import type { Food, Goals, Metrics, Photo, Pr, Report } from '../types'

export const REPORT: Report = {
  day: '2026-07-06',
  meals: [
    {
      id: 1,
      food_id: 1,
      meal_type: 'Almoço',
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
      meal_type: 'Lanche',
      name: 'whey protein',
      grams: 30,
      kcal: 120,
      protein_g: 24,
      carbs_g: 3,
      fat_g: 1.8,
    },
  ],
  sets: [
    {
      id: 1,
      exercise: 'supino reto',
      sets: 2,
      reps: 10,
      weight_kg: 60,
      rest_s: 90,
      is_pr: 1,
      volume_kg: 1200,
    },
  ],
  totals: { kcal: 438, protein_g: 88, carbs_g: 3, fat_g: 6.8, volume_kg: 1200, water_ml: 2600 },
  duration_min: 72,
}

export const GOALS: Goals = { kcal: 2500, protein_g: 150, water_ml: 4000, carbs_g: 300, fat_g: 70 }

export const EMPTY_REPORT: Report = {
  day: '2026-07-05',
  meals: [],
  sets: [],
  totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, volume_kg: 0, water_ml: 0 },
  duration_min: null,
}

export const METRICS: Metrics = {
  unit: 'kg',
  points: [
    { day: '2026-07-01', value: 1000 },
    { day: '2026-07-02', value: 1100 },
    { day: '2026-07-03', value: 1150 },
    { day: '2026-07-04', value: 1200 },
    { day: '2026-07-05', value: 1250 },
    { day: '2026-07-06', value: 1300 },
    { day: '2026-07-07', value: 1340 },
  ],
}

export const EXERCISES = ['agachamento', 'supino reto']

export const PRS: Pr[] = [{ exercise: 'supino reto', weight_kg: 70, day: '2026-07-07' }]

export const PHOTOS: Photo[] = [
  { id: 1, day: '2026-07-07', category: 'Frente', url: '/api/photos/file/a.png' },
  { id: 2, day: '2026-07-07', category: 'Lado', url: '/api/photos/file/b.png' },
  { id: 3, day: '2026-07-01', category: 'Frente', url: '/api/photos/file/c.png' },
]

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
