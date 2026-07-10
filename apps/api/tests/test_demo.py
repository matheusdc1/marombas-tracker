from app import db, demo


def _counts():
    conn = db.connect()
    meals = conn.execute("SELECT COUNT(*) FROM meals").fetchone()[0]
    sets_ = conn.execute("SELECT COUNT(*) FROM workout_sets").fetchone()[0]
    water = conn.execute("SELECT COUNT(*) FROM water").fetchone()[0]
    conn.close()
    return meals, sets_, water


def test_seed_popula_e_e_idempotente(tmp_path, monkeypatch):
    monkeypatch.setenv("MAROMBAS_DB", str(tmp_path / "demo.db"))
    message = demo.seed()
    assert "14 dias" in message
    meals, sets_, water = _counts()
    assert meals == 14 * len(demo.DAILY_MEALS)
    assert sets_ > 0  # dias de descanso nao treinam
    assert water == 14  # um registro de agua por dia
    # sem --force nao repovoa
    assert "ja tem dados" in demo.seed()
    assert _counts() == (meals, sets_, water)
    # com force repovoa do zero
    assert "14 dias" in demo.seed(force=True)
    assert _counts() == (meals, sets_, water)


def test_seed_progride_carga(tmp_path, monkeypatch):
    monkeypatch.setenv("MAROMBAS_DB", str(tmp_path / "demo.db"))
    demo.seed()
    conn = db.connect()
    loads = [
        row[0]
        for row in conn.execute(
            "SELECT weight_kg FROM workout_sets WHERE exercise = 'supino reto' ORDER BY day"
        )
    ]
    conn.close()
    assert len(loads) > 1
    assert loads[-1] > loads[0]  # progressao ao longo das semanas
