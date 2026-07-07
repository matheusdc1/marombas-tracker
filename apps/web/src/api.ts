import type { ChatResult, Food, Progress, Report } from './types'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
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

export const addMeal = (day: string, food_id: number, grams: number) =>
  req<{ id: number }>(`/api/log/${day}/meals`, json({ food_id, grams }))

export const deleteMeal = (id: number) =>
  req<{ ok: boolean }>(`/api/meals/${id}`, { method: 'DELETE' })

export const addSet = (
  day: string,
  set: { exercise: string; sets: number; reps: number; weight_kg: number },
) => req<{ id: number }>(`/api/log/${day}/sets`, json(set))

export const deleteSet = (id: number) =>
  req<{ ok: boolean }>(`/api/sets/${id}`, { method: 'DELETE' })

export const getProgress = (exercise: string) =>
  req<Progress>(`/api/progress?exercise=${encodeURIComponent(exercise)}`)

export const sendChat = (day: string, message: string) =>
  req<ChatResult>('/api/chat', json({ day, message }))

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
