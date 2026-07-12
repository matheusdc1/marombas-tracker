"""Camada de LLM real (Gemini) do chat.

Mesmo papel do parser mock, mas invertido: em vez de devolver estruturas para o
endpoint inserir, o modelo registra ELE MESMO via tools — cada tool valida e grava
no banco, e o modelo nunca inventa valor nutricional (a regra o obriga a passar por
buscar_alimento/TACO). Sem GEMINI_API_KEY, o endpoint continua no parser mock.
"""

import os
import sqlite3
from pathlib import Path

from google import genai
from google.genai import types

from .db import record_pr

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "system_prompt.txt"
# pinado (nao "-latest"): comportamento reprodutivel; 2.5-flash foi recusado
# para contas novas (404 "no longer available to new users") em 12/07/2026
DEFAULT_MODEL = "gemini-3.5-flash"
# temperatura 0: extração de dados não é tarefa criativa — queremos a mesma
# mensagem virando sempre o mesmo registro (experimentos em docs/experimentos.md)
TEMPERATURE = 0.0

MEAL_TYPES = ("Café da manhã", "Almoço", "Lanche", "Jantar", "Ceia")


def available() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def make_tools(db: sqlite3.Connection, day: str, counts: dict[str, int]) -> list:
    """Tools expostas ao modelo, como closures sobre a conexão e o dia do diário.

    O SDK deriva a declaração de cada tool da assinatura tipada + docstring:
    as docstrings abaixo são lidas PELO MODELO — são engenharia de prompt.
    """

    def buscar_alimento(termo: str) -> list[dict]:
        """Busca alimentos na tabela TACO por nome (busca parcial, em minúsculas).

        Chame SEMPRE antes de registrar uma refeição: os valores nutricionais vêm
        daqui, nunca de estimativa. Devolve id, nome e macros por 100g (até 5).
        """
        rows = db.execute(
            "SELECT id, name, kcal, protein_g, carbs_g, fat_g FROM foods"
            " WHERE name LIKE ? ORDER BY name LIMIT 5",
            (f"%{termo.strip().lower()}%",),
        ).fetchall()
        return [dict(r) for r in rows]

    def registrar_refeicao(food_id: int, gramas: float, tipo_refeicao: str) -> dict:
        """Registra uma refeição no diário do dia.

        food_id: id devolvido por buscar_alimento. gramas: quantidade em gramas
        (líquidos em ml contam 1:1). tipo_refeicao: exatamente um de
        "Café da manhã", "Almoço", "Lanche", "Jantar", "Ceia".
        Devolve as kcal e macros calculados, para citar na resposta.
        """
        if tipo_refeicao not in MEAL_TYPES:
            return {"erro": f"tipo_refeicao inválido; use um de {list(MEAL_TYPES)}"}
        if gramas <= 0:
            return {"erro": "gramas deve ser maior que zero"}
        food = db.execute("SELECT * FROM foods WHERE id = ?", (food_id,)).fetchone()
        if not food:
            return {"erro": "food_id não existe; use buscar_alimento antes"}
        db.execute(
            "INSERT INTO meals (day, food_id, grams, meal_type) VALUES (?, ?, ?, ?)",
            (day, food_id, gramas, tipo_refeicao),
        )
        counts["meals"] += 1
        return {
            "ok": True,
            "alimento": food["name"],
            "kcal": round(food["kcal"] * gramas / 100, 1),
            "protein_g": round(food["protein_g"] * gramas / 100, 1),
            "carbs_g": round(food["carbs_g"] * gramas / 100, 1),
            "fat_g": round(food["fat_g"] * gramas / 100, 1),
        }

    def registrar_serie(
        exercicio: str, series: int, repeticoes: int, carga_kg: float, descanso_s: int
    ) -> dict:
        """Registra séries de um exercício no treino do dia.

        carga_kg é a carga TOTAL (some os dois lados quando o usuário disser
        "de cada lado"); 0 para exercício com peso corporal. descanso_s: segundos
        de descanso entre séries, 0 quando não informado. Devolve o volume e
        novo_pr=true quando a carga supera todo o histórico do exercício.
        """
        if series <= 0 or repeticoes <= 0 or carga_kg < 0 or descanso_s < 0:
            return {"erro": "series/repeticoes devem ser > 0; carga e descanso, >= 0"}
        nome = exercicio.strip().lower()
        cur = db.execute(
            "INSERT INTO workout_sets (day, exercise, sets, reps, weight_kg, rest_s)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (day, nome, series, repeticoes, carga_kg, descanso_s or None),
        )
        is_pr = record_pr(db, cur.lastrowid, day, nome, carga_kg)
        counts["sets"] += 1
        return {"ok": True, "volume_kg": series * repeticoes * carga_kg, "novo_pr": is_pr}

    def registrar_agua(ml: float) -> dict:
        """Registra consumo de água do dia, em ml (converta litros: 1,5l = 1500)."""
        if ml <= 0:
            return {"erro": "ml deve ser maior que zero"}
        db.execute("INSERT INTO water (day, ml) VALUES (?, ?)", (day, ml))
        return {"ok": True, "ml": ml}

    def registrar_peso_corporal(kg: float) -> dict:
        """Registra o peso corporal do usuário no dia, em kg."""
        if kg <= 0:
            return {"erro": "kg deve ser maior que zero"}
        db.execute("INSERT INTO body_weight (day, kg) VALUES (?, ?)", (day, kg))
        return {"ok": True, "kg": kg}

    def registrar_duracao_treino(minutos: int) -> dict:
        """Registra a duração total do treino do dia, em minutos (1h10 = 70)."""
        if minutos <= 0:
            return {"erro": "minutos deve ser maior que zero"}
        db.execute(
            "INSERT INTO workout_meta (day, duration_min) VALUES (?, ?)"
            " ON CONFLICT(day) DO UPDATE SET duration_min = excluded.duration_min",
            (day, minutos),
        )
        return {"ok": True, "minutos": minutos}

    return [
        buscar_alimento,
        registrar_refeicao,
        registrar_serie,
        registrar_agua,
        registrar_peso_corporal,
        registrar_duracao_treino,
    ]


def chat(db: sqlite3.Connection, day: str, message: str) -> dict:
    """Envia a mensagem ao Gemini com as tools; o modelo registra e resume."""
    counts = {"meals": 0, "sets": 0}
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL),
        contents=f"Dia do diário: {day}\nMensagem: {message}",
        config=types.GenerateContentConfig(
            system_instruction=system_prompt(),
            temperature=TEMPERATURE,
            tools=make_tools(db, day, counts),
        ),
    )
    return {
        "reply": response.text or "Não consegui interpretar a mensagem.",
        "meals_logged": counts["meals"],
        "sets_logged": counts["sets"],
        "unmatched": [],
    }
