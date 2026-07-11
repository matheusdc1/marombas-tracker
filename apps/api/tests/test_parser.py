from app.parser import parse
from app.taco_seed import FOODS

FOOD_DICTS = [
    {"id": i, "name": name, "kcal": kcal, "protein_g": p, "carbs_g": c, "fat_g": f}
    for i, (name, kcal, p, c, f) in enumerate(FOODS, 1)
]

EXAMPLE = (
    "hoje comi 200g de frango, 100g de arroz pesado cru, 30g de azeite, "
    "350ml de leite e 30g de whey. treinei fullbody, "
    "2 series de supino reto 30kg de cada lado 10 reps, "
    "2 series de barra fixa 5 reps cada serie, "
    "2 series de agachamento 40kg de cada lado, "
    "2 series de abdominal com carga 30kg 9 reps."
)


def test_exemplo_completo():
    result = parse(EXAMPLE, FOOD_DICTS)
    assert [(m["food"]["name"], m["grams"]) for m in result["meals"]] == [
        ("frango grelhado", 200.0),
        ("arroz branco cru", 100.0),
        ("azeite de oliva", 30.0),
        ("leite integral", 350.0),
        ("whey protein", 30.0),
    ]
    assert result["sets"] == [
        {"exercise": "supino reto", "sets": 2, "reps": 10, "weight_kg": 60.0},
        {"exercise": "barra fixa", "sets": 2, "reps": 5, "weight_kg": 0.0},
        {"exercise": "agachamento", "sets": 2, "reps": 10, "weight_kg": 80.0},
        {"exercise": "abdominal com carga", "sets": 2, "reps": 9, "weight_kg": 30.0},
    ]
    assert result["unmatched"] == []


def test_kg_e_virgula_decimal():
    result = parse("comi 0,5kg de batata doce", FOOD_DICTS)
    assert result["meals"] == [
        {
            "food": next(f for f in FOOD_DICTS if f["name"] == "batata doce cozida"),
            "grams": 500.0,
            "meal_type": "Almoço",
        }
    ]


def test_refeicao_por_horario_na_mensagem():
    message = (
        "no café da manhã comi 60g de aveia e 120g de banana, "
        "no almoço 200g de frango, e na ceia 30g de whey"
    )
    result = parse(message, FOOD_DICTS)
    assert [(m["food"]["name"], m["meal_type"]) for m in result["meals"]] == [
        ("aveia em flocos", "Café da manhã"),
        ("banana", "Café da manhã"),
        ("frango grelhado", "Almoço"),
        ("whey protein", "Ceia"),
    ]


def test_litro_vira_gramas():
    result = parse("tomei 1l de leite desnatado", FOOD_DICTS)
    assert result["meals"][0]["grams"] == 1000.0
    assert result["meals"][0]["food"]["name"] == "leite desnatado"


def test_alimento_desconhecido():
    result = parse("comi 100g de picanha", FOOD_DICTS)
    assert result["meals"] == []
    assert result["unmatched"] == ["picanha"]


def test_serie_sem_exercicio_ignorada():
    result = parse("fiz 2 series de 30kg 10 reps", FOOD_DICTS)
    assert result["sets"] == []
    assert result["unmatched"] == ["fiz 2 series de 30kg 10 reps"]


def test_exercicio_antes_das_series():
    result = parse("supino reto 3 séries de 12 com 30kg", FOOD_DICTS)
    assert result["sets"] == [
        {"exercise": "supino reto", "sets": 3, "reps": 12, "weight_kg": 30.0}
    ]


def test_series_sem_de():
    result = parse("fiz 4 series supino inclinado 24kg", FOOD_DICTS)
    assert result["sets"] == [
        {"exercise": "supino inclinado", "sets": 4, "reps": 10, "weight_kg": 24.0}
    ]


def test_notacao_nxm():
    result = parse("treinei costas: remada curvada 3x8 40kg, barra fixa 2x6", FOOD_DICTS)
    assert result["sets"] == [
        {"exercise": "remada curvada", "sets": 3, "reps": 8, "weight_kg": 40.0},
        {"exercise": "barra fixa", "sets": 2, "reps": 6, "weight_kg": 0.0},
    ]


def test_nxm_nao_confunde_refeicao():
    result = parse("comi 2x 100g de arroz branco cozido", FOOD_DICTS)
    assert result["sets"] == []
    assert result["meals"][0]["food"]["name"] == "arroz branco cozido"


def test_treino_e_refeicao_juntos():
    result = parse("comi 150g de frango e fiz agachamento 5 séries de 5 com 100kg", FOOD_DICTS)
    assert result["meals"][0]["food"]["name"] == "frango grelhado"
    assert result["sets"] == [
        {"exercise": "agachamento", "sets": 5, "reps": 5, "weight_kg": 100.0}
    ]


def test_carga_com_virgula():
    result = parse("3 series de rosca direta 12,5kg 8 reps", FOOD_DICTS)
    assert result["sets"] == [
        {"exercise": "rosca direta", "sets": 3, "reps": 8, "weight_kg": 12.5}
    ]


def test_mensagem_sem_nada():
    assert parse("bom dia!", FOOD_DICTS) == {"meals": [], "sets": [], "unmatched": []}
