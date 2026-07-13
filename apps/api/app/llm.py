"""Camada de LLM real do chat (OpenRouter ou Gemini).

Mesmo papel do parser mock, mas invertido: em vez de devolver estruturas para o
endpoint inserir, o modelo registra ELE MESMO via tools — cada tool valida e grava
no banco, e o modelo nunca inventa valor nutricional (a regra o obriga a passar por
buscar_alimento/TACO). Provedores, por ordem de preferência da chave presente:
OPENROUTER_API_KEY (modelos abertos via API OpenAI-compatível, loop de tools manual)
ou GEMINI_API_KEY (SDK google-genai, loop automático). Sem chave, o endpoint fica
no parser mock.
"""

import json
import os
import sqlite3
import time
from pathlib import Path

import httpx
from google import genai
from google.genai import types

from .db import record_pr

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "system_prompt.txt"
# Hy3 gratuito no OpenRouter — anunciado como disponível só até 21/07/2026;
# quando sair do ar, trocar via env OPENROUTER_MODEL (nada de código)
DEFAULT_OPENROUTER_MODEL = "tencent/hy3:free"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# pinado (nao "-latest"): comportamento reprodutível; 2.5-flash foi recusado
# para contas novas (404) e o 3.5-flash dá só 20 req/dia no free tier
DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
# temperatura 0: extração de dados não é tarefa criativa — queremos a mesma
# mensagem virando sempre o mesmo registro (experimentos em docs/experimentos.md)
TEMPERATURE = 0.0
MAX_TOOL_ROUNDS = 8
# teto de tempo da conversa inteira com o provedor: a transacao do request segura
# o lock de escrita do sqlite — um loop lento a mais nao pode travar a API toda
DEADLINE_S = 120
# resposta e curta (lista de registros); o teto barra geracao interminavel em
# temperatura alta — o timeout de leitura do httpx e por chunk, nao total
MAX_TOKENS = 700

MEAL_TYPES = ("Café da manhã", "Almoço", "Lanche", "Jantar", "Ceia")


def available() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY"))


def system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def make_tools(db: sqlite3.Connection, day: str, counts: dict[str, int]) -> list:
    """Tools expostas ao modelo, como closures sobre a conexão e o dia do diário.

    As docstrings e limites de sanidade são lidos PELO MODELO (viram a declaração
    da tool nos dois provedores) — descrição clara aqui é engenharia de prompt.
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

        food_id: id devolvido por buscar_alimento. gramas: quantidade em gramas,
        entre 1 e 3000 (líquidos em ml contam 1:1). tipo_refeicao: exatamente um de
        "Café da manhã", "Almoço", "Lanche", "Jantar", "Ceia".
        Devolve as kcal e macros calculados, para citar na resposta.
        """
        if tipo_refeicao not in MEAL_TYPES:
            return {"erro": f"tipo_refeicao inválido; use um de {list(MEAL_TYPES)}"}
        if not 0 < gramas <= 3000:
            return {"erro": "gramas implausível: use um valor entre 1 e 3000"}
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

        carga_kg é a carga TOTAL, até 500 (some os dois lados quando o usuário
        disser "de cada lado"); 0 para exercício com peso corporal. descanso_s:
        segundos de descanso entre séries, 0 quando não informado. Devolve o volume
        e novo_pr=true quando a carga supera todo o histórico do exercício.
        """
        if not 0 < series <= 50 or not 0 < repeticoes <= 200:
            return {"erro": "series (1-50) e repeticoes (1-200) fora da faixa"}
        if not 0 <= carga_kg <= 500 or not 0 <= descanso_s <= 3600:
            return {"erro": "carga_kg (0-500) ou descanso_s (0-3600) implausível"}
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
        """Registra consumo de água do dia, em ml, até 10000 (1,5l = 1500)."""
        if not 0 < ml <= 10000:
            return {"erro": "ml implausível: use um valor entre 1 e 10000"}
        db.execute("INSERT INTO water (day, ml) VALUES (?, ?)", (day, ml))
        return {"ok": True, "ml": ml}

    def registrar_peso_corporal(kg: float) -> dict:
        """Registra o peso corporal do usuário no dia, em kg (entre 20 e 400)."""
        if not 20 <= kg <= 400:
            return {"erro": "kg implausível para peso corporal: use entre 20 e 400"}
        db.execute("INSERT INTO body_weight (day, kg) VALUES (?, ?)", (day, kg))
        return {"ok": True, "kg": kg}

    def registrar_duracao_treino(minutos: int) -> dict:
        """Registra a duração total do treino do dia, em minutos, até 600 (1h10 = 70)."""
        if not 0 < minutos <= 600:
            return {"erro": "minutos implausível: use um valor entre 1 e 600"}
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


# parâmetros tipados das tools no formato OpenAI (OpenRouter); as descrições em
# prosa vêm das docstrings acima, para não manter dois textos
_NUM = {"type": "number"}
_INT = {"type": "integer"}
PARAM_SCHEMAS = {
    "buscar_alimento": {
        "type": "object",
        "properties": {"termo": {"type": "string", "description": "nome (ou parte) do alimento"}},
        "required": ["termo"],
    },
    "registrar_refeicao": {
        "type": "object",
        "properties": {
            "food_id": _INT,
            "gramas": _NUM,
            "tipo_refeicao": {"type": "string", "enum": list(MEAL_TYPES)},
        },
        "required": ["food_id", "gramas", "tipo_refeicao"],
    },
    "registrar_serie": {
        "type": "object",
        "properties": {
            "exercicio": {"type": "string"},
            "series": _INT,
            "repeticoes": _INT,
            "carga_kg": _NUM,
            "descanso_s": _INT,
        },
        "required": ["exercicio", "series", "repeticoes", "carga_kg", "descanso_s"],
    },
    "registrar_agua": {"type": "object", "properties": {"ml": _NUM}, "required": ["ml"]},
    "registrar_peso_corporal": {"type": "object", "properties": {"kg": _NUM}, "required": ["kg"]},
    "registrar_duracao_treino": {
        "type": "object",
        "properties": {"minutos": _INT},
        "required": ["minutos"],
    },
}


def tools_spec(tools: list) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t.__name__,
                "description": t.__doc__,
                "parameters": PARAM_SCHEMAS[t.__name__],
            },
        }
        for t in tools
    ]


def _chat_openrouter(tools: list, day: str, message: str) -> str:
    """Loop manual de tool calling na API OpenAI-compatível do OpenRouter."""
    by_name = {t.__name__: t for t in tools}
    messages = [
        {"role": "system", "content": system_prompt()},
        {"role": "user", "content": f"Dia do diário: {day}\nMensagem: {message}"},
    ]
    deadline = time.monotonic() + DEADLINE_S
    for _ in range(MAX_TOOL_ROUNDS):
        restante = deadline - time.monotonic()
        if restante <= 0:
            # estourar aqui derruba para o mock (rollback incluso) em vez de
            # devolver um registro pela metade
            raise TimeoutError("LLM excedeu o tempo limite da conversa")
        resp = httpx.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"},
            json={
                "model": os.environ.get("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL),
                "messages": messages,
                "tools": tools_spec(tools),
                "temperature": TEMPERATURE,
                "max_tokens": MAX_TOKENS,
            },
            timeout=min(60, restante),
        )
        resp.raise_for_status()
        msg = resp.json()["choices"][0]["message"]
        calls = msg.get("tool_calls")
        if not calls:
            return msg.get("content") or ""
        messages.append(msg)
        for call in calls:
            fn = by_name.get(call["function"]["name"])
            try:
                result = fn(**json.loads(call["function"]["arguments"] or "{}"))
            except (TypeError, ValueError) as exc:  # tool ou argumentos inválidos
                result = {"erro": f"chamada inválida: {exc}"}
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )
    return "Não consegui concluir o registro: excesso de chamadas de ferramenta."


def _chat_gemini(tools: list, day: str, message: str) -> str:
    """Gemini via SDK oficial: o loop de tools é automático (funções Python)."""
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model=os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL),
        contents=f"Dia do diário: {day}\nMensagem: {message}",
        config=types.GenerateContentConfig(
            system_instruction=system_prompt(),
            temperature=TEMPERATURE,
            tools=tools,
        ),
    )
    return response.text or ""


def chat(db: sqlite3.Connection, day: str, message: str) -> dict:
    """Envia a mensagem ao LLM com as tools; o modelo registra e resume."""
    counts = {"meals": 0, "sets": 0}
    tools = make_tools(db, day, counts)
    if os.environ.get("OPENROUTER_API_KEY"):
        reply = _chat_openrouter(tools, day, message)
    else:
        reply = _chat_gemini(tools, day, message)
    return {
        "reply": reply or "Não consegui interpretar a mensagem.",
        "meals_logged": counts["meals"],
        "sets_logged": counts["sets"],
        "unmatched": [],
    }
