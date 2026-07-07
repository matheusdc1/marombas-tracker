from app import db
from app.taco_seed import FOODS


def test_seed_roda_uma_vez(tmp_path, monkeypatch):
    monkeypatch.setenv("MAROMBAS_DB", str(tmp_path / "x.db"))
    conn = db.connect()
    first = conn.execute("SELECT COUNT(*) FROM foods").fetchone()[0]
    conn.close()
    conn = db.connect()
    second = conn.execute("SELECT COUNT(*) FROM foods").fetchone()[0]
    conn.close()
    assert first == second == len(FOODS)
    assert (tmp_path / "x.db").exists()
