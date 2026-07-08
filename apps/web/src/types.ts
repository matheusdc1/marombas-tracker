export interface Food {
  id: number
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealRow {
  id: number
  food_id: number
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
}

export interface SetRow {
  id: number
  exercise: string
  sets: number
  reps: number
  weight_kg: number
  volume_kg: number
}

export interface Totals {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  volume_kg: number
}

export interface Report {
  day: string
  meals: MealRow[]
  sets: SetRow[]
  totals: Totals
}

export interface ProgressPoint {
  day: string
  volume_kg: number
}

export interface Progress {
  exercises: string[]
  points: ProgressPoint[]
}

export interface ChatResult {
  reply: string
  meals_logged: number
  sets_logged: number
  unmatched: string[]
}
