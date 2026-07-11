export interface Food {
  id: number
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export const MEAL_TYPES = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Ceia'] as const

export type MealType = (typeof MEAL_TYPES)[number]

export interface MealRow {
  id: number
  food_id: number
  meal_type: MealType
  name: string
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface Goals {
  kcal: number
  protein_g: number
  water_ml: number
  carbs_g: number
  fat_g: number
}

export interface SetRow {
  id: number
  exercise: string
  sets: number
  reps: number
  weight_kg: number
  rest_s: number | null
  is_pr: number
  volume_kg: number
}

export interface Totals {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  volume_kg: number
  water_ml: number
}

export interface Report {
  day: string
  meals: MealRow[]
  sets: SetRow[]
  totals: Totals
  duration_min: number | null
}

export interface MetricPoint {
  day: string
  value: number
}

export interface Metrics {
  unit: string
  points: MetricPoint[]
}

export interface Pr {
  exercise: string
  weight_kg: number
  day: string
}

export const PHOTO_CATEGORIES = ['Frente', 'Lado', 'Costas'] as const

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]

export interface Photo {
  id: number
  day: string
  category: PhotoCategory
  url: string
}

export interface ChatResult {
  reply: string
  meals_logged: number
  sets_logged: number
  unmatched: string[]
}
