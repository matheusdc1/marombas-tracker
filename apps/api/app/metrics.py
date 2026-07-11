"""Métricas da tela de Evolução, peso corporal e histórico de PRs."""

import sqlite3
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from .db import get_db
from .routes import valid_day

router = APIRouter(prefix="/api")

Metric = Literal["volume", "peso", "calorias", "proteina", "agua", "exercicio"]

QUERIES: dict[str, tuple[str, str]] = {
    "volume": (
        "kg",
        "SELECT day, ROUND(SUM(sets * reps * weight_kg), 1) AS value"
        " FROM workout_sets WHERE day >= ? GROUP BY day ORDER BY day",
    ),
    "calorias": (
        "kcal",
        "SELECT m.day, ROUND(SUM(f.kcal * m.grams / 100), 1) AS value FROM meals m"
        " JOIN foods f ON f.id = m.food_id WHERE m.day >= ? GROUP BY m.day ORDER BY m.day",
    ),
    "proteina": (
        "g",
        "SELECT m.day, ROUND(SUM(f.protein_g * m.grams / 100), 1) AS value FROM meals m"
        " JOIN foods f ON f.id = m.food_id WHERE m.day >= ? GROUP BY m.day ORDER BY m.day",
    ),
    "agua": (
        "ml",
        "SELECT day, ROUND(SUM(ml), 1) AS value FROM water"
        " WHERE day >= ? GROUP BY day ORDER BY day",
    ),
    "peso": (
        "kg",
        # ultimo registro de cada dia
        "SELECT day, kg AS value FROM body_weight b"
        " WHERE id = (SELECT MAX(id) FROM body_weight WHERE day = b.day) AND day >= ?"
        " ORDER BY day",
    ),
}


@router.get("/metrics")
def metrics(
    metric: Metric,
    days: int = Query(30, gt=0),
    exercise: str = "",
    db: sqlite3.Connection = Depends(get_db),
):
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    if metric == "exercicio":
        rows = db.execute(
            "SELECT day, MAX(weight_kg) AS value FROM workout_sets"
            " WHERE exercise = ? AND day >= ? GROUP BY day ORDER BY day",
            (exercise, cutoff),
        )
        unit = "kg"
    else:
        unit, sql = QUERIES[metric]
        rows = db.execute(sql, (cutoff,))
    return {"unit": unit, "points": [dict(r) for r in rows]}


@router.get("/exercises")
def exercises(db: sqlite3.Connection = Depends(get_db)):
    return [
        r[0] for r in db.execute("SELECT DISTINCT exercise FROM workout_sets ORDER BY exercise")
    ]


@router.get("/prs")
def prs(db: sqlite3.Connection = Depends(get_db)):
    return [
        dict(r)
        for r in db.execute("SELECT exercise, weight_kg, day FROM prs ORDER BY day DESC, id DESC")
    ]


class WeightIn(BaseModel):
    day: str
    kg: float = Field(gt=0)


@router.post("/weight", status_code=201)
def add_weight(body: WeightIn, db: sqlite3.Connection = Depends(get_db)):
    valid_day(body.day)
    cur = db.execute("INSERT INTO body_weight (day, kg) VALUES (?, ?)", (body.day, body.kg))
    return {"id": cur.lastrowid}
