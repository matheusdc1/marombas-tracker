import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import parser
from .db import get_db

router = APIRouter(prefix="/api")


def valid_day(day: str) -> str:
    try:
        date.fromisoformat(day)
    except ValueError:
        raise HTTPException(400, "dia invalido, use YYYY-MM-DD")
    return day


class MealIn(BaseModel):
    food_id: int
    grams: float = Field(gt=0)


class SetIn(BaseModel):
    exercise: str = Field(min_length=1)
    sets: int = Field(gt=0)
    reps: int = Field(gt=0)
    weight_kg: float = Field(ge=0)


class FoodIn(BaseModel):
    name: str = Field(min_length=1)
    kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)


class ChatIn(BaseModel):
    message: str = Field(min_length=1)
    day: str


class GoalsIn(BaseModel):
    kcal: float = Field(gt=0)
    protein_g: float = Field(gt=0)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/foods")
def list_foods(q: str = "", db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM foods WHERE name LIKE ? ORDER BY name", (f"%{q}%",)
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("/foods", status_code=201)
def add_food(body: FoodIn, db: sqlite3.Connection = Depends(get_db)):
    try:
        cur = db.execute(
            "INSERT INTO foods (name, kcal, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?)",
            (body.name.strip().lower(), body.kcal, body.protein_g, body.carbs_g, body.fat_g),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "alimento ja existe")
    return {"id": cur.lastrowid}


@router.get("/log/{day}")
def report(day: str, db: sqlite3.Connection = Depends(get_db)):
    valid_day(day)
    meals = [
        dict(r)
        for r in db.execute(
            """SELECT m.id, m.food_id, f.name, m.grams,
                      ROUND(f.kcal * m.grams / 100, 1) AS kcal,
                      ROUND(f.protein_g * m.grams / 100, 1) AS protein_g,
                      ROUND(f.carbs_g * m.grams / 100, 1) AS carbs_g,
                      ROUND(f.fat_g * m.grams / 100, 1) AS fat_g
               FROM meals m JOIN foods f ON f.id = m.food_id
               WHERE m.day = ? ORDER BY m.id""",
            (day,),
        )
    ]
    sets_ = [
        dict(r)
        for r in db.execute(
            "SELECT id, exercise, sets, reps, weight_kg, sets * reps * weight_kg AS volume_kg "
            "FROM workout_sets WHERE day = ? ORDER BY id",
            (day,),
        )
    ]
    totals = {
        key: round(sum(m[key] for m in meals), 1)
        for key in ("kcal", "protein_g", "carbs_g", "fat_g")
    }
    totals["volume_kg"] = round(sum(s["volume_kg"] for s in sets_), 1)
    return {"day": day, "meals": meals, "sets": sets_, "totals": totals}


@router.post("/log/{day}/meals", status_code=201)
def add_meal(day: str, body: MealIn, db: sqlite3.Connection = Depends(get_db)):
    valid_day(day)
    if not db.execute("SELECT 1 FROM foods WHERE id = ?", (body.food_id,)).fetchone():
        raise HTTPException(404, "alimento nao encontrado")
    cur = db.execute(
        "INSERT INTO meals (day, food_id, grams) VALUES (?, ?, ?)",
        (day, body.food_id, body.grams),
    )
    return {"id": cur.lastrowid}


@router.put("/meals/{meal_id}")
def update_meal(meal_id: int, body: MealIn, db: sqlite3.Connection = Depends(get_db)):
    if not db.execute("SELECT 1 FROM foods WHERE id = ?", (body.food_id,)).fetchone():
        raise HTTPException(404, "alimento nao encontrado")
    updated = db.execute(
        "UPDATE meals SET food_id = ?, grams = ? WHERE id = ?",
        (body.food_id, body.grams, meal_id),
    ).rowcount
    if updated == 0:
        raise HTTPException(404, "refeicao nao encontrada")
    return {"ok": True}


@router.delete("/meals/{meal_id}")
def delete_meal(meal_id: int, db: sqlite3.Connection = Depends(get_db)):
    if db.execute("DELETE FROM meals WHERE id = ?", (meal_id,)).rowcount == 0:
        raise HTTPException(404, "refeicao nao encontrada")
    return {"ok": True}


@router.post("/log/{day}/sets", status_code=201)
def add_set(day: str, body: SetIn, db: sqlite3.Connection = Depends(get_db)):
    valid_day(day)
    cur = db.execute(
        "INSERT INTO workout_sets (day, exercise, sets, reps, weight_kg) VALUES (?, ?, ?, ?, ?)",
        (day, body.exercise.strip().lower(), body.sets, body.reps, body.weight_kg),
    )
    return {"id": cur.lastrowid}


@router.put("/sets/{set_id}")
def update_set(set_id: int, body: SetIn, db: sqlite3.Connection = Depends(get_db)):
    updated = db.execute(
        "UPDATE workout_sets SET exercise = ?, sets = ?, reps = ?, weight_kg = ? WHERE id = ?",
        (body.exercise.strip().lower(), body.sets, body.reps, body.weight_kg, set_id),
    ).rowcount
    if updated == 0:
        raise HTTPException(404, "serie nao encontrada")
    return {"ok": True}


@router.delete("/sets/{set_id}")
def delete_set(set_id: int, db: sqlite3.Connection = Depends(get_db)):
    if db.execute("DELETE FROM workout_sets WHERE id = ?", (set_id,)).rowcount == 0:
        raise HTTPException(404, "serie nao encontrada")
    return {"ok": True}


@router.get("/goals")
def get_goals(db: sqlite3.Connection = Depends(get_db)):
    return dict(db.execute("SELECT kcal, protein_g FROM goals WHERE id = 1").fetchone())


@router.put("/goals")
def put_goals(body: GoalsIn, db: sqlite3.Connection = Depends(get_db)):
    db.execute(
        "UPDATE goals SET kcal = ?, protein_g = ? WHERE id = 1", (body.kcal, body.protein_g)
    )
    return {"ok": True}


@router.get("/progress")
def progress(exercise: str = "", db: sqlite3.Connection = Depends(get_db)):
    where, params = "", []
    if exercise:
        where, params = "WHERE exercise = ?", [exercise]
    points = [
        dict(r)
        for r in db.execute(
            f"SELECT day, ROUND(SUM(sets * reps * weight_kg), 1) AS volume_kg "
            f"FROM workout_sets {where} GROUP BY day ORDER BY day",
            params,
        )
    ]
    exercises = [
        r[0] for r in db.execute("SELECT DISTINCT exercise FROM workout_sets ORDER BY exercise")
    ]
    return {"exercises": exercises, "points": points}


@router.post("/chat")
def chat(body: ChatIn, db: sqlite3.Connection = Depends(get_db)):
    """Mock do LLM: interpreta a mensagem, registra no diario e responde um resumo."""
    valid_day(body.day)
    foods = [dict(r) for r in db.execute("SELECT * FROM foods")]
    parsed = parser.parse(body.message, foods)

    meal_lines, total_kcal = [], 0.0
    for meal in parsed["meals"]:
        food, grams = meal["food"], meal["grams"]
        db.execute(
            "INSERT INTO meals (day, food_id, grams) VALUES (?, ?, ?)",
            (body.day, food["id"], grams),
        )
        kcal = food["kcal"] * grams / 100
        total_kcal += kcal
        meal_lines.append(
            f"- {grams:g}g de {food['name']} — {kcal:.0f} kcal "
            f"(P {food['protein_g'] * grams / 100:.1f}g / "
            f"C {food['carbs_g'] * grams / 100:.1f}g / "
            f"G {food['fat_g'] * grams / 100:.1f}g)"
        )

    set_lines, total_volume = [], 0.0
    for item in parsed["sets"]:
        db.execute(
            "INSERT INTO workout_sets (day, exercise, sets, reps, weight_kg) VALUES (?, ?, ?, ?, ?)",
            (body.day, item["exercise"], item["sets"], item["reps"], item["weight_kg"]),
        )
        volume = item["sets"] * item["reps"] * item["weight_kg"]
        total_volume += volume
        load = f"{item['weight_kg']:g}kg" if item["weight_kg"] else "peso corporal"
        set_lines.append(
            f"- {item['exercise']}: {item['sets']}x{item['reps']} @ {load} (volume {volume:g}kg)"
        )

    parts = [f"Registrado em {body.day}:"]
    if meal_lines:
        parts.append(f"\nRefeições (≈ {total_kcal:.0f} kcal):\n" + "\n".join(meal_lines))
    if set_lines:
        parts.append(f"\nTreino (volume total {total_volume:g}kg):\n" + "\n".join(set_lines))
    if not meal_lines and not set_lines:
        parts = ["Não encontrei refeições nem séries na mensagem. "
                 "Tente algo como: '200g de frango, 2 séries de supino 30kg 10 reps'."]
    if parsed["unmatched"]:
        parts.append("\nNão reconheci na tabela TACO: " + ", ".join(parsed["unmatched"]))

    return {
        "reply": "\n".join(parts),
        "meals_logged": len(parsed["meals"]),
        "sets_logged": len(parsed["sets"]),
        "unmatched": parsed["unmatched"],
    }
