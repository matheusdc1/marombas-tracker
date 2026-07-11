"""Popula o banco com ~2 semanas de dados de demonstracao.

Uso: python -m app.demo [--force]
Sem --force nao mexe num banco que ja tem registros (idempotente).
--force apaga refeicoes/series existentes antes de popular (alimentos ficam).
"""

import sys
from datetime import date, timedelta

from .db import connect

# refeicoes de um dia tipico (nome exato da tabela TACO, gramas, refeicao)
DAILY_MEALS = [
    ("aveia em flocos", 60, "Café da manhã"),
    ("banana", 120, "Café da manhã"),
    ("leite integral", 300, "Café da manhã"),
    ("arroz branco cozido", 250, "Almoço"),
    ("feijão carioca cozido", 140, "Almoço"),
    ("frango grelhado", 200, "Almoço"),
    ("whey protein", 30, "Lanche"),
    ("batata doce cozida", 200, "Jantar"),
    ("carne patinho grelhado", 150, "Jantar"),
]

# rotacao A / B / descanso; a carga progride 2,5kg por semana
SPLITS = [
    [("supino reto", 4, 10, 40.0), ("remada curvada", 4, 10, 40.0), ("barra fixa", 3, 8, 0.0)],
    [
        ("agachamento", 4, 10, 60.0),
        ("levantamento terra", 3, 8, 70.0),
        ("abdominal com carga", 3, 12, 20.0),
    ],
    None,
]


def seed(days: int = 14, force: bool = False) -> str:
    conn = connect()
    try:
        existing = conn.execute("SELECT COUNT(*) FROM meals").fetchone()[0]
        existing += conn.execute("SELECT COUNT(*) FROM workout_sets").fetchone()[0]
        existing += conn.execute("SELECT COUNT(*) FROM water").fetchone()[0]
        if existing and not force:
            return "banco ja tem dados — rode com --force para repovoar"
        conn.execute("DELETE FROM meals")
        conn.execute("DELETE FROM workout_sets")
        conn.execute("DELETE FROM water")
        conn.execute("DELETE FROM prs")
        conn.execute("DELETE FROM body_weight")
        conn.execute("DELETE FROM workout_meta")
        food_ids = {
            name: conn.execute("SELECT id FROM foods WHERE name = ?", (name,)).fetchone()[0]
            for name, _, _ in DAILY_MEALS
        }
        today = date.today()
        for offset in range(days - 1, -1, -1):
            day = (today - timedelta(days=offset)).isoformat()
            index = days - 1 - offset  # 0 = dia mais antigo
            for name, grams, meal_type in DAILY_MEALS:
                conn.execute(
                    "INSERT INTO meals (day, food_id, grams, meal_type) VALUES (?, ?, ?, ?)",
                    (day, food_ids[name], grams + index % 3 * 10, meal_type),
                )
            conn.execute(
                "INSERT INTO water (day, ml) VALUES (?, ?)", (day, 2000 + index % 4 * 500)
            )
            conn.execute(
                "INSERT INTO body_weight (day, kg) VALUES (?, ?)",
                (day, round(83.0 - index * 0.1, 1)),
            )
            split = SPLITS[index % len(SPLITS)]
            if split is None:
                continue
            week = index // 7
            conn.execute(
                "INSERT INTO workout_meta (day, duration_min) VALUES (?, ?)",
                (day, 60 + index % 3 * 8),
            )
            for exercise, sets_, reps, weight in split:
                load = weight + week * 2.5 if weight else 0.0
                previous = conn.execute(
                    "SELECT MAX(weight_kg) FROM workout_sets WHERE exercise = ?", (exercise,)
                ).fetchone()[0]
                cur = conn.execute(
                    "INSERT INTO workout_sets (day, exercise, sets, reps, weight_kg, rest_s)"
                    " VALUES (?, ?, ?, ?, ?, ?)",
                    (day, exercise, sets_, reps, load, 90),
                )
                if load > 0 and (previous is None or load > previous):
                    conn.execute(
                        "INSERT INTO prs (set_id, exercise, weight_kg, day) VALUES (?, ?, ?, ?)",
                        (cur.lastrowid, exercise, load, day),
                    )
        conn.commit()
        return f"demo: {days} dias populados ate {today.isoformat()}"
    finally:
        conn.close()


def main() -> None:  # pragma: no cover
    print(seed(force="--force" in sys.argv))


if __name__ == "__main__":  # pragma: no cover
    main()
