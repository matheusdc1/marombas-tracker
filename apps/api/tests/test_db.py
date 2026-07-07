import threading

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


def test_conexao_cruza_threads(tmp_path, monkeypatch):
    """Regressao: o FastAPI usa a conexao em threads diferentes do pool.

    Sem check_same_thread=False o sqlite3 levanta ProgrammingError aqui.
    """
    monkeypatch.setenv("MAROMBAS_DB", str(tmp_path / "x.db"))
    conn = db.connect()
    errors: list[Exception] = []

    def query():
        try:
            conn.execute("SELECT COUNT(*) FROM foods").fetchone()
        except Exception as exc:  # pragma: no cover - so falha na regressao
            errors.append(exc)

    thread = threading.Thread(target=query)
    thread.start()
    thread.join()
    conn.close()
    assert errors == []
