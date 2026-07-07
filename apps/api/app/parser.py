"""Parser mock — simula o que o LLM (via MCP + adapter GLM/DeepSeek) fará na fase final.

Extrai de uma mensagem em linguagem natural:
- refeicoes: "200g de frango", "350ml de leite", "0,5kg de batata doce"
- series:    "2 series de supino reto 30kg de cada lado 10 reps"

Regras do mock (limitacoes deliberadas, documentadas no README):
- ml ~ g (aproximacao 1:1, ok para liquidos comuns);
- "de cada lado" dobra a carga (barra nao contada);
- serie sem "reps" assume 10; serie sem "kg" assume peso corporal (0 kg);
- alimento casa por sobreposicao de palavras com a tabela TACO (sem acentos).
"""

import re
import unicodedata

STOPWORDS = {"de", "do", "da", "dos", "das", "com", "em", "e", "o", "a"}

FOOD_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|l)\s+de\s+([^\d,.;]+?)(?=\s+e\s+\d|[,.;]|$)",
    re.IGNORECASE,
)
# virgula/ponto seguidos de digito sao decimais ("12,5kg"), nao fim do segmento
SET_RE = re.compile(r"(\d+)\s*s[eé]ries?\s+de\s+((?:[^,.;]|[,.](?=\d))+)", re.IGNORECASE)
WEIGHT_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*kg", re.IGNORECASE)
REPS_RE = re.compile(r"(\d+)\s*rep", re.IGNORECASE)
EACH_SIDE_RE = re.compile(r"cada\s+lado", re.IGNORECASE)


def norm(text: str) -> str:
    """minusculas + sem acentos, para casamento tolerante."""
    return unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()


def words(text: str) -> set[str]:
    return set(norm(text).split()) - STOPWORDS


def best_food(phrase: str, foods: list[dict]) -> dict | None:
    """Alimento com maior sobreposicao de palavras; empate: nome mais curto."""
    target = words(phrase)
    candidates = []
    for food in foods:
        score = len(target & words(food["name"]))
        if score:
            candidates.append((-score, len(food["name"]), food["name"], food))
    return min(candidates)[3] if candidates else None


def _to_grams(qty: str, unit: str) -> float:
    value = float(qty.replace(",", "."))
    return value * 1000 if unit.lower() in ("kg", "l") else value


def parse(message: str, foods: list[dict]) -> dict:
    meals, unmatched = [], []
    for qty, unit, phrase in FOOD_RE.findall(message):
        phrase = phrase.strip()
        if norm(phrase).startswith("cada"):  # artefato de "30kg de cada lado"
            continue
        food = best_food(phrase, foods)
        if food:
            meals.append({"food": food, "grams": _to_grams(qty, unit)})
        else:
            unmatched.append(phrase)

    sets_ = []
    for count, segment in SET_RE.findall(message):
        exercise = re.match(r"[^\d]*", segment).group().strip()
        if not exercise:
            continue
        weight = 0.0
        weight_match = WEIGHT_RE.search(segment)
        if weight_match:
            weight = float(weight_match.group(1).replace(",", "."))
            if EACH_SIDE_RE.search(segment):
                weight *= 2
        reps_match = REPS_RE.search(segment)
        reps = int(reps_match.group(1)) if reps_match else 10
        sets_.append(
            {"exercise": exercise, "sets": int(count), "reps": reps, "weight_kg": weight}
        )

    return {"meals": meals, "sets": sets_, "unmatched": unmatched}
