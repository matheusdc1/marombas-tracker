import type { ChatResult, Food, Goals, Progress, Report } from './types'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // em produção (Railway, front e api em serviços separados) VITE_API_URL
  // aponta para a api; em dev fica vazio e o proxy do Vite resolve /api
  const res = await fetch((import.meta.env.VITE_API_URL ?? '') + path, init)
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

export const updateMeal = (id: number, food_id: number, grams: number) =>
  req<{ ok: boolean }>(`/api/meals/${id}`, { ...json({ food_id, grams }), method: 'PUT' })

export const deleteMeal = (id: number) =>
  req<{ ok: boolean }>(`/api/meals/${id}`, { method: 'DELETE' })

export const addSet = (
  day: string,
  set: { exercise: string; sets: number; reps: number; weight_kg: number },
) => req<{ id: number }>(`/api/log/${day}/sets`, json(set))

export const updateSet = (
  id: number,
  set: { exercise: string; sets: number; reps: number; weight_kg: number },
) => req<{ ok: boolean }>(`/api/sets/${id}`, { ...json(set), method: 'PUT' })

export const deleteSet = (id: number) =>
  req<{ ok: boolean }>(`/api/sets/${id}`, { method: 'DELETE' })

export const getGoals = () => req<Goals>('/api/goals')

export const putGoals = (goals: Goals) =>
  req<{ ok: boolean }>('/api/goals', { ...json(goals), method: 'PUT' })

export const getProgress = (exercise: string) =>
  req<Progress>(`/api/progress?exercise=${encodeURIComponent(exercise)}`)

export const sendChat = (day: string, message: string) =>
  req<ChatResult>('/api/chat', json({ day, message }))

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
