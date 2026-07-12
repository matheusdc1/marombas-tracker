from datetime import date, timedelta

from app import llm
from tests.test_parser import EXAMPLE

DAY = "2026-07-06"


def _d(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_busca_alimentos(client):
    foods = client.get("/api/foods", params={"q": "frango"}).json()
    assert len(foods) == 2
    assert all("frango" in f["name"] for f in foods)


def test_add_alimento_custom_e_duplicado(client):
    body = {"name": "Hipercalórico X", "kcal": 420, "protein_g": 20, "carbs_g": 70, "fat_g": 5}
    assert client.post("/api/foods", json=body).status_code == 201
    assert client.post("/api/foods", json=body).status_code == 409


def test_crud_refeicao_e_relatorio(client):
    whey = client.get("/api/foods", params={"q": "whey"}).json()[0]
    r = client.post(f"/api/log/{DAY}/meals", json={"food_id": whey["id"], "grams": 50})
    assert r.status_code == 201
    report = client.get(f"/api/log/{DAY}").json()
    assert report["totals"]["kcal"] == 200.0  # whey: 400 kcal/100g * 50g
    assert report["totals"]["protein_g"] == 40.0
    meal_id = report["meals"][0]["id"]
    assert client.delete(f"/api/meals/{meal_id}").json() == {"ok": True}
    assert client.delete(f"/api/meals/{meal_id}").status_code == 404


def test_refeicao_alimento_inexistente(client):
    r = client.post(f"/api/log/{DAY}/meals", json={"food_id": 99999, "grams": 100})
    assert r.status_code == 404


def test_dia_invalido(client):
    assert client.get("/api/log/ontem").status_code == 400


def test_crud_series_e_metricas(client):
    for days_ago, weight in [(3, 60), (1, 70)]:
        r = client.post(
            f"/api/log/{_d(days_ago)}/sets",
            json={"exercise": "Supino Reto", "sets": 2, "reps": 10, "weight_kg": weight},
        )
        assert r.status_code == 201
    volume = client.get("/api/metrics", params={"metric": "volume", "days": 7}).json()
    assert volume["unit"] == "kg"
    assert volume["points"] == [
        {"day": _d(3), "value": 1200.0},
        {"day": _d(1), "value": 1400.0},
    ]
    # o filtro de período corta os pontos antigos
    recent = client.get("/api/metrics", params={"metric": "volume", "days": 2}).json()
    assert recent["points"] == [{"day": _d(1), "value": 1400.0}]
    exercicio = client.get(
        "/api/metrics", params={"metric": "exercicio", "exercise": "supino reto", "days": 7}
    ).json()
    assert exercicio["points"] == [{"day": _d(3), "value": 60.0}, {"day": _d(1), "value": 70.0}]
    assert client.get("/api/exercises").json() == ["supino reto"]
    assert client.get("/api/metrics", params={"metric": "inexistente"}).status_code == 422
    set_id = client.get(f"/api/log/{_d(3)}").json()["sets"][0]["id"]
    assert client.delete(f"/api/sets/{set_id}").json() == {"ok": True}
    assert client.delete(f"/api/sets/{set_id}").status_code == 404


def test_duracao_do_treino(client):
    assert client.get(f"/api/log/{DAY}").json()["duration_min"] is None
    assert client.put(f"/api/log/{DAY}/workout", json={"duration_min": 72}).json() == {"ok": True}
    assert client.get(f"/api/log/{DAY}").json()["duration_min"] == 72
    client.put(f"/api/log/{DAY}/workout", json={"duration_min": 45})  # upsert
    assert client.get(f"/api/log/{DAY}").json()["duration_min"] == 45
    assert client.put("/api/log/ontem/workout", json={"duration_min": 10}).status_code == 400


def test_descanso_e_pr(client):
    first = client.post(
        f"/api/log/{DAY}/sets",
        json={"exercise": "supino", "sets": 3, "reps": 10, "weight_kg": 60, "rest_s": 90},
    ).json()
    assert first["is_pr"] is True  # primeiro registro do exercício conta
    lighter = client.post(
        f"/api/log/{DAY}/sets",
        json={"exercise": "supino", "sets": 3, "reps": 10, "weight_kg": 50},
    ).json()
    assert lighter["is_pr"] is False
    heavier = client.post(
        f"/api/log/{DAY}/sets",
        json={"exercise": "supino", "sets": 3, "reps": 8, "weight_kg": 70, "rest_s": 120},
    ).json()
    assert heavier["is_pr"] is True
    bodyweight = client.post(
        f"/api/log/{DAY}/sets",
        json={"exercise": "barra fixa", "sets": 3, "reps": 8, "weight_kg": 0},
    ).json()
    assert bodyweight["is_pr"] is False  # peso corporal não gera PR
    sets_ = client.get(f"/api/log/{DAY}").json()["sets"]
    assert [s["is_pr"] for s in sets_] == [1, 0, 1, 0]
    assert sets_[0]["rest_s"] == 90
    assert sets_[1]["rest_s"] is None
    prs = client.get("/api/prs").json()
    assert [(p["exercise"], p["weight_kg"]) for p in prs] == [("supino", 70.0), ("supino", 60.0)]
    # apagar a série remove o PR dela do histórico
    client.delete(f"/api/sets/{sets_[2]['id']}")
    remaining = client.get("/api/prs").json()
    assert [(p["exercise"], p["weight_kg"]) for p in remaining] == [("supino", 60.0)]


def test_chat_anuncia_pr(client):
    data = client.post("/api/chat", json={"message": "fiz supino 3x10 100kg", "day": DAY}).json()
    assert "NOVO PR" in data["reply"]


def test_peso_corporal(client):
    assert client.post("/api/weight", json={"day": DAY, "kg": 82.5}).status_code == 201
    assert client.post("/api/weight", json={"day": "ontem", "kg": 82}).status_code == 400


def test_chat_exemplo_completo(client):
    r = client.post("/api/chat", json={"message": EXAMPLE, "day": DAY})
    assert r.status_code == 200
    data = r.json()
    assert data["meals_logged"] == 5
    assert data["sets_logged"] == 4
    assert data["unmatched"] == []
    assert "supino reto" in data["reply"]
    assert "peso corporal" in data["reply"]  # barra fixa sem carga
    report = client.get(f"/api/log/{DAY}").json()
    assert report["totals"]["kcal"] == 1274.7
    assert report["totals"]["volume_kg"] == 3340.0


def test_chat_sem_conteudo(client):
    data = client.post("/api/chat", json={"message": "bom dia!", "day": DAY}).json()
    assert data["meals_logged"] == 0
    assert "Não encontrei" in data["reply"]


def test_chat_alimento_desconhecido(client):
    data = client.post("/api/chat", json={"message": "comi 100g de picanha", "day": DAY}).json()
    assert data["unmatched"] == ["picanha"]
    assert "Não reconheci" in data["reply"]


def test_chat_dia_invalido(client):
    assert client.post("/api/chat", json={"message": "oi", "day": "hoje"}).status_code == 400


def test_chat_usa_o_llm_quando_ha_chave(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "chave")
    sentinel = {"reply": "ok do llm", "meals_logged": 2, "sets_logged": 1, "unmatched": []}
    monkeypatch.setattr(llm, "chat", lambda db, day, message: sentinel)
    assert client.post("/api/chat", json={"message": "x", "day": DAY}).json() == sentinel


def test_chat_degrada_para_o_mock_quando_o_llm_falha(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "chave")

    def boom(db, day, message):
        raise RuntimeError("cota estourada")

    monkeypatch.setattr(llm, "chat", boom)
    data = client.post(
        "/api/chat", json={"message": "fiz supino 3x10 100kg", "day": DAY}
    ).json()
    assert data["reply"].startswith("[LLM indisponível")
    assert data["sets_logged"] == 1  # o mock assumiu e registrou


def test_metas_get_e_put(client):
    assert client.get("/api/goals").json() == {
        "kcal": 2500.0,
        "protein_g": 150.0,
        "water_ml": 4000.0,
        "carbs_g": 300.0,
        "fat_g": 70.0,
    }
    body = {"kcal": 3000, "protein_g": 180, "water_ml": 3500, "carbs_g": 310, "fat_g": 75}
    assert client.put("/api/goals", json=body).json() == {"ok": True}
    assert client.get("/api/goals").json() == {
        "kcal": 3000.0,
        "protein_g": 180.0,
        "water_ml": 3500.0,
        "carbs_g": 310.0,
        "fat_g": 75.0,
    }


def test_refeicao_por_horario(client):
    whey = client.get("/api/foods", params={"q": "whey"}).json()[0]
    default = client.post(f"/api/log/{DAY}/meals", json={"food_id": whey["id"], "grams": 30})
    assert default.status_code == 201
    jantar = client.post(
        f"/api/log/{DAY}/meals",
        json={"food_id": whey["id"], "grams": 30, "meal_type": "Jantar"},
    )
    assert jantar.status_code == 201
    meals = client.get(f"/api/log/{DAY}").json()["meals"]
    assert [m["meal_type"] for m in meals] == ["Almoço", "Jantar"]
    invalid = client.post(
        f"/api/log/{DAY}/meals",
        json={"food_id": whey["id"], "grams": 30, "meal_type": "Madrugada"},
    )
    assert invalid.status_code == 422


def test_agua(client):
    assert client.post(f"/api/log/{DAY}/water", json={"ml": 250}).status_code == 201
    assert client.post(f"/api/log/{DAY}/water", json={"ml": 500}).status_code == 201
    report = client.get(f"/api/log/{DAY}").json()
    assert report["totals"]["water_ml"] == 750.0
    assert client.get("/api/log/2026-07-05").json()["totals"]["water_ml"] == 0
    assert client.post("/api/log/ontem/water", json={"ml": 250}).status_code == 400
    assert client.post(f"/api/log/{DAY}/water", json={"ml": 0}).status_code == 422


def test_edita_refeicao(client):
    whey = client.get("/api/foods", params={"q": "whey"}).json()[0]
    arroz = client.get("/api/foods", params={"q": "arroz branco cozido"}).json()[0]
    meal_id = client.post(
        f"/api/log/{DAY}/meals", json={"food_id": whey["id"], "grams": 30}
    ).json()["id"]
    r = client.put(f"/api/meals/{meal_id}", json={"food_id": arroz["id"], "grams": 200})
    assert r.json() == {"ok": True}
    meal = client.get(f"/api/log/{DAY}").json()["meals"][0]
    assert meal["name"] == "arroz branco cozido"
    assert meal["grams"] == 200
    assert meal["food_id"] == arroz["id"]
    assert (
        client.put("/api/meals/99999", json={"food_id": arroz["id"], "grams": 100}).status_code
        == 404
    )
    assert (
        client.put(f"/api/meals/{meal_id}", json={"food_id": 99999, "grams": 100}).status_code
        == 404
    )


def test_edita_serie(client):
    set_id = client.post(
        f"/api/log/{DAY}/sets",
        json={"exercise": "supino reto", "sets": 2, "reps": 10, "weight_kg": 60},
    ).json()["id"]
    body = {"exercise": "Supino Inclinado", "sets": 4, "reps": 8, "weight_kg": 50}
    assert client.put(f"/api/sets/{set_id}", json=body).json() == {"ok": True}
    updated = client.get(f"/api/log/{DAY}").json()["sets"][0]
    assert updated["exercise"] == "supino inclinado"
    assert updated["volume_kg"] == 4 * 8 * 50
    assert client.put("/api/sets/99999", json=body).status_code == 404
