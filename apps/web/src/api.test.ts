import { describe, expect, it } from 'vitest'
import {
  addMeal,
  addSet,
  deleteMeal,
  deleteSet,
  getFoods,
  getProgress,
  getReport,
  sendChat,
  todayIso,
} from './api'
import { FOODS, PROGRESS, REPORT, mockFetch } from './__tests__/helpers'

describe('api', () => {
  it('monta as URLs e métodos certos', async () => {
    const fn = mockFetch({
      'GET /api/foods': FOODS,
      'GET /api/log/2026-07-06': REPORT,
      'GET /api/progress': PROGRESS,
      'POST /api/log/2026-07-06/meals': { id: 1 },
      'POST /api/log/2026-07-06/sets': { id: 2 },
      'POST /api/chat': { reply: 'ok', meals_logged: 0, sets_logged: 0, unmatched: [] },
      'DELETE /api/meals/7': { ok: true },
      'DELETE /api/sets/8': { ok: true },
    })
    expect(await getFoods('fran go')).toEqual(FOODS)
    expect(fn).toHaveBeenLastCalledWith('/api/foods?q=fran%20go', undefined)
    expect(await getReport('2026-07-06')).toEqual(REPORT)
    expect(await getProgress('supino reto')).toEqual(PROGRESS)
    expect(fn).toHaveBeenLastCalledWith('/api/progress?exercise=supino%20reto', undefined)
    expect(await addMeal('2026-07-06', 1, 150)).toEqual({ id: 1 })
    expect(JSON.parse((fn.mock.lastCall![1] as RequestInit).body as string)).toEqual({
      food_id: 1,
      grams: 150,
    })
    expect(
      await addSet('2026-07-06', { exercise: 'supino', sets: 2, reps: 10, weight_kg: 60 }),
    ).toEqual({ id: 2 })
    expect(await sendChat('2026-07-06', 'comi 100g de arroz')).toMatchObject({ reply: 'ok' })
    expect(await deleteMeal(7)).toEqual({ ok: true })
    expect(await deleteSet(8)).toEqual({ ok: true })
  })

  it('lança erro quando a resposta não é 2xx', async () => {
    mockFetch({})
    await expect(getReport('2026-07-06')).rejects.toThrow('Erro 404')
  })

  it('todayIso devolve a data local em YYYY-MM-DD', () => {
    const d = new Date()
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    expect(todayIso()).toBe(expected)
  })
})
