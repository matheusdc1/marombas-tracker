import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def _sem_llm_por_padrao(monkeypatch):
    # uma GEMINI_API_KEY real na maquina nao pode vazar para os testes do mock
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("MAROMBAS_DB", str(tmp_path / "test.db"))
    return TestClient(app)
