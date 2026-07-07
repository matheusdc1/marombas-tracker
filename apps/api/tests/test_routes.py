from tests.test_parser import EXAMPLE

DAY = "2026-07-06"


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


def test_crud_series_e_progresso(client):
    for day, weight in [("2026-07-01", 60), ("2026-07-03", 70)]:
        r = client.post(
            f"/api/log/{day}/sets",
            json={"exercise": "Supino Reto", "sets": 2, "reps": 10, "weight_kg": weight},
        )
        assert r.status_code == 201
    progress = client.get("/api/progress").json()
    assert progress["exercises"] == ["supino reto"]
    assert progress["points"] == [
        {"day": "2026-07-01", "volume_kg": 1200.0},
        {"day": "2026-07-03", "volume_kg": 1400.0},
    ]
    filtered = client.get("/api/progress", params={"exercise": "supino reto"}).json()
    assert filtered["points"] == progress["points"]
    assert client.get("/api/progress", params={"exercise": "remada"}).json()["points"] == []
    set_id = client.get("/api/log/2026-07-01").json()["sets"][0]["id"]
    assert client.delete(f"/api/sets/{set_id}").json() == {"ok": True}
    assert client.delete(f"/api/sets/{set_id}").status_code == 404


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
