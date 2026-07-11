from datetime import date, timedelta


def _d(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


def test_metricas_de_dieta_agua_e_peso(client):
    frango = client.get("/api/foods", params={"q": "frango grelhado"}).json()[0]
    for days_ago, grams in [(2, 100), (1, 200)]:
        client.post(f"/api/log/{_d(days_ago)}/meals", json={"food_id": frango["id"], "grams": grams})

    kcal = client.get("/api/metrics", params={"metric": "calorias", "days": 7}).json()
    assert kcal["unit"] == "kcal"
    assert kcal["points"] == [
        {"day": _d(2), "value": 159.0},
        {"day": _d(1), "value": 318.0},
    ]
    proteina = client.get("/api/metrics", params={"metric": "proteina", "days": 7}).json()
    assert proteina["unit"] == "g"
    assert proteina["points"][-1]["value"] == 64.0

    client.post(f"/api/log/{_d(1)}/water", json={"ml": 500})
    agua = client.get("/api/metrics", params={"metric": "agua", "days": 7}).json()
    assert agua["points"] == [{"day": _d(1), "value": 500.0}]

    client.post("/api/weight", json={"day": _d(2), "kg": 83.0})
    client.post("/api/weight", json={"day": _d(1), "kg": 82.6})
    client.post("/api/weight", json={"day": _d(1), "kg": 82.4})  # o último do dia vale
    peso = client.get("/api/metrics", params={"metric": "peso", "days": 7}).json()
    assert peso["unit"] == "kg"
    assert peso["points"] == [
        {"day": _d(2), "value": 83.0},
        {"day": _d(1), "value": 82.4},
    ]
