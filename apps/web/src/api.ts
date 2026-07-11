import type {
  ChatResult,
  Food,
  Goals,
  MealType,
  Metrics,
  Photo,
  PhotoCategory,
  Pr,
  Report,
} from './types'

// em produção (Railway, front e api em serviços separados) VITE_API_URL
// aponta para a api; em dev fica vazio e o proxy do Vite resolve /api
export function apiUrl(path: string): string {
  return (import.meta.env.VITE_API_URL ?? '') + path
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), init)
  if (!res.ok) throw new Error(`Erro ${res.status} em ${path}`)
  return res.json() as Promise<T>
}

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const getFoods = (q: string) => req<Food[]>(`/api/foods?q=${encodeURIComponent(q)}`)

export const getReport = (day: string) => req<Report>(`/api/log/${day}`)

export const addMeal = (day: string, food_id: number, grams: number, meal_type: MealType) =>
  req<{ id: number }>(`/api/log/${day}/meals`, json({ food_id, grams, meal_type }))

export const updateMeal = (id: number, food_id: number, grams: number, meal_type: MealType) =>
  req<{ ok: boolean }>(`/api/meals/${id}`, {
    ...json({ food_id, grams, meal_type }),
    method: 'PUT',
  })

export const deleteMeal = (id: number) =>
  req<{ ok: boolean }>(`/api/meals/${id}`, { method: 'DELETE' })

export interface SetData {
  exercise: string
  sets: number
  reps: number
  weight_kg: number
  rest_s: number | null
}

export const addSet = (day: string, set: SetData) =>
  req<{ id: number; is_pr: boolean }>(`/api/log/${day}/sets`, json(set))

export const updateSet = (id: number, set: SetData) =>
  req<{ ok: boolean }>(`/api/sets/${id}`, { ...json(set), method: 'PUT' })

export const putWorkoutDuration = (day: string, duration_min: number) =>
  req<{ ok: boolean }>(`/api/log/${day}/workout`, { ...json({ duration_min }), method: 'PUT' })

export const deleteSet = (id: number) =>
  req<{ ok: boolean }>(`/api/sets/${id}`, { method: 'DELETE' })

export const addWater = (day: string, ml: number) =>
  req<{ id: number }>(`/api/log/${day}/water`, json({ ml }))

export const getGoals = () => req<Goals>('/api/goals')

export const putGoals = (goals: Goals) =>
  req<{ ok: boolean }>('/api/goals', { ...json(goals), method: 'PUT' })

export const getMetrics = (metric: string, days: number, exercise: string) =>
  req<Metrics>(`/api/metrics?metric=${metric}&days=${days}&exercise=${encodeURIComponent(exercise)}`)

export const getExercises = () => req<string[]>('/api/exercises')

export const getPrs = () => req<Pr[]>('/api/prs')

export const addWeight = (day: string, kg: number) =>
  req<{ id: number }>('/api/weight', json({ day, kg }))

export const getPhotos = () => req<Photo[]>('/api/photos')

export const uploadPhoto = (day: string, category: PhotoCategory, file: File) => {
  const form = new FormData()
  form.append('day', day)
  form.append('category', category)
  form.append('file', file)
  return req<Photo>('/api/photos', { method: 'POST', body: form })
}

export const deletePhoto = (id: number) =>
  req<{ ok: boolean }>(`/api/photos/${id}`, { method: 'DELETE' })

export const sendChat = (day: string, message: string) =>
  req<ChatResult>('/api/chat', json({ day, message }))

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
