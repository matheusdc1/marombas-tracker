"""Parser mock — simula o que o LLM (via MCP + adapter GLM/DeepSeek) fará na fase final.

Extrai de uma mensagem em linguagem natural:
- refeicoes: "200g de frango", "350ml de leite", "0,5kg de batata doce"
- series, nas ordens comuns de academia (uma por clausula, separadas
  por virgula/ponto/dois-pontos):
    "2 series de supino reto 30kg de cada lado 10 reps"
    "supino reto 3 series de 12 com 30kg"
    "4 series supino inclinado 24kg"
    "remada curvada 3x8 40kg"

Regras do mock (limitacoes deliberadas, documentadas no README):
- ml ~ g (aproximacao 1:1, ok para liquidos comuns);
- "de cada lado" dobra a carga (barra nao contada);
- serie sem reps assume 10; sem kg assume peso corporal (0 kg);
- alimento casa por sobreposicao de palavras com a tabela TACO (sem acentos);
- dois exercicios na MESMA clausula ("remada 3x8 e supino 3x10" sem virgula)
  viram um so — separar por virgula. O LLM real nao tera essa limitacao.
"""

import re
import unicodedata

STOPWORDS = {"de", "do", "da", "dos", "das", "com", "em", "e", "o", "a"}

FOOD_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|l)\s+de\s+([^\d,.;]+?)(?=\s+e\s+|[,.;]|$)",
    re.IGNORECASE,
)

# clausulas: virgula/ponto/dois-pontos que nao sejam decimais ("12,5kg"),
# e " e " antes de nova contagem de series ("... e 3 series de remada")
CLAUSE_RE = re.compile(r"[,.;:\n](?!\d)|\s+e\s+(?=\d+\s*s[eé]ri)", re.IGNORECASE)
SETS_RE = re.compile(r"(\d+)\s*s[eé]ries?", re.IGNORECASE)
# "3x8" — bloqueia unidades depois do segundo numero ("2x 100g" e refeicao)
NXM_RE = re.compile(r"(\d+)\s*x\s*(\d+)(?!\s*(?:g|kg|ml|l)\b|[.,]?\d)", re.IGNORECASE)
REPS_RE = re.compile(r"(\d+)\s*(?:rep|vezes)", re.IGNORECASE)
# "3 series de 12" — o 12 e reps, desde que nao seja carga ("de 12,5kg")
SERIES_OF_N_RE = re.compile(r"s[eé]ries?\s+de\s+(\d+)(?![.,]?\d|\s*(?:kg|x))", re.IGNORECASE)
WEIGHT_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*kg", re.IGNORECASE)
EACH_SIDE_RE = re.compile(r"cada\s+lado", re.IGNORECASE)
NUMERIC_TOKEN = re.compile(r"^\d+(?:[.,]\d+)?(?:kg|g|ml|l|x\d+)?$", re.IGNORECASE)
# ruido aparado so nas BORDAS do nome do exercicio ("com" interno sobrevive:
# "abdominal com carga"; "series de" na frente e "reps" no fim caem)
EDGE_NOISE = {
    "serie", "series", "de", "do", "da", "com", "e", "no", "na", "cada", "lado",
    "rep", "reps", "repeticao", "repeticoes", "vezes", "fiz", "treinei", "hoje", "kg", "x",
    "comi", "bebi", "tomei",
}


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


def _exercise_from(clause: str) -> str:
    """Nome do exercicio = tokens nao-numericos, aparando ruido das bordas."""
    tokens = [t for t in clause.split() if not NUMERIC_TOKEN.match(t)]
    while tokens and norm(tokens[0]) in EDGE_NOISE:
        tokens.pop(0)
    while tokens and norm(tokens[-1]) in EDGE_NOISE:
        tokens.pop()
    return " ".join(tokens).lower()


def _parse_set_clause(clause: str) -> dict | None:
    sets_match = SETS_RE.search(clause)
    nxm = NXM_RE.search(clause)
    if not sets_match and not nxm:
        return None
    sets_ = int(sets_match.group(1)) if sets_match else int(nxm.group(1))
    weight = 0.0
    weight_match = WEIGHT_RE.search(clause)
    if weight_match:
        weight = float(weight_match.group(1).replace(",", "."))
        if EACH_SIDE_RE.search(clause):
            weight *= 2
    reps_match = REPS_RE.search(clause)
    if reps_match:
        reps = int(reps_match.group(1))
    elif nxm:
        reps = int(nxm.group(2))
    else:
        bare = SERIES_OF_N_RE.search(clause)
        reps = int(bare.group(1)) if bare else 10
    return {
        "exercise": _exercise_from(clause),
        "sets": sets_,
        "reps": reps,
        "weight_kg": weight,
    }


def _without_spans(message: str, spans: list[tuple[int, int]]) -> str:
    out, last = [], 0
    for start, end in spans:
        out.append(message[last:start])
        last = end
    out.append(message[last:])
    return " ".join(out)


def parse(message: str, foods: list[dict]) -> dict:
    meals, unmatched, meal_spans = [], [], []
    for match in FOOD_RE.finditer(message):
        qty, unit, phrase = match.group(1), match.group(2), match.group(3).strip()
        if norm(phrase).startswith("cada"):  # artefato de "30kg de cada lado"
            continue
        meal_spans.append(match.span())
        food = best_food(phrase, foods)
        if food:
            meals.append({"food": food, "grams": _to_grams(qty, unit)})
        else:
            unmatched.append(phrase)

    # series sao extraidas com as refeicoes removidas do texto, para o nome
    # do exercicio nao herdar pedacos de comida ("comi 150g de frango e fiz...")
    sets_ = []
    for clause in CLAUSE_RE.split(_without_spans(message, meal_spans)):
        parsed = _parse_set_clause(clause)
        if parsed is None:
            continue
        if not parsed["exercise"]:
            unmatched.append(clause.strip())
            continue
        sets_.append(parsed)

    return {"meals": meals, "sets": sets_, "unmatched": unmatched}
