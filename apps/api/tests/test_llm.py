from types import SimpleNamespace

import pytest

from app import db as dbmod
from app import llm

DAY = "2026-07-06"


@pytest.fixture()
def conn(tmp_path, monkeypatch):
    monkeypatch.setenv("MAROMBAS_DB", str(tmp_path / "test.db"))
    c = dbmod.connect()
    yield c
    c.close()


def test_available_depende_da_chave(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert llm.available() is False
    monkeypatch.setenv("GEMINI_API_KEY", "chave")
    assert llm.available() is True


def test_system_prompt_vem_do_arquivo_versionado():
    text = llm.system_prompt()
    assert "<regras>" in text
    assert "buscar_alimento" in text  # o prompt referencia as tools pelo nome real


def test_buscar_alimento_e_registrar_refeicao(conn):
    counts = {"meals": 0, "sets": 0}
    buscar, registrar, *_ = llm.make_tools(conn, DAY, counts)
    achados = buscar("Frango ")
    assert achados and all("frango" in f["name"] for f in achados)
    out = registrar(achados[0]["id"], 200, "Jantar")
    assert out["ok"] is True
    assert out["kcal"] > 0
    assert counts["meals"] == 1
    row = conn.execute("SELECT meal_type, grams FROM meals").fetchone()
    assert (row["meal_type"], row["grams"]) == ("Jantar", 200)


def test_registrar_refeicao_erros_viram_retorno_para_o_modelo(conn):
    counts = {"meals": 0, "sets": 0}
    _, registrar, *_ = llm.make_tools(conn, DAY, counts)
    assert "erro" in registrar(99999, 100, "Almoço")
    assert "erro" in registrar(1, -5, "Almoço")
    assert "erro" in registrar(1, 100, "Brunch")
    assert counts["meals"] == 0


def test_registrar_serie_com_pr_e_erros(conn):
    counts = {"meals": 0, "sets": 0}
    serie = llm.make_tools(conn, DAY, counts)[2]
    out = serie("Supino Reto", 2, 10, 60.0, 90)
    assert out == {"ok": True, "volume_kg": 1200.0, "novo_pr": True}
    out2 = serie("supino reto", 2, 10, 50.0, 0)  # carga menor: nao e PR
    assert out2["novo_pr"] is False
    assert conn.execute("SELECT rest_s FROM workout_sets WHERE rest_s IS NULL").fetchone()
    assert "erro" in serie("supino", 0, 10, 60.0, 0)
    assert counts["sets"] == 2


def test_registrar_agua_peso_e_duracao(conn):
    counts = {"meals": 0, "sets": 0}
    _, _, _, agua, peso, duracao = llm.make_tools(conn, DAY, counts)
    assert agua(500) == {"ok": True, "ml": 500}
    assert "erro" in agua(0)
    assert peso(82.5) == {"ok": True, "kg": 82.5}
    assert "erro" in peso(-1)
    assert duracao(72) == {"ok": True, "minutos": 72}
    assert duracao(80) == {"ok": True, "minutos": 80}  # upsert do mesmo dia
    assert "erro" in duracao(0)
    assert conn.execute("SELECT duration_min FROM workout_meta").fetchone()[0] == 80


class _FakeClient:
    """Dublê do genai.Client: captura a chamada e simula o modelo usando uma tool."""

    captured: dict = {}

    def __init__(self, api_key):
        _FakeClient.captured = {"api_key": api_key}
        self.models = self

    def generate_content(self, *, model, contents, config):
        _FakeClient.captured.update(model=model, contents=contents, config=config)
        tools = {t.__name__: t for t in config.tools}
        achado = tools["buscar_alimento"]("arroz")[0]
        tools["registrar_refeicao"](achado["id"], 100, "Almoço")
        return SimpleNamespace(text="Registrado: 100g de arroz.")


def test_chat_configura_o_modelo_e_devolve_o_contrato(conn, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "chave-teste")
    monkeypatch.setattr(llm.genai, "Client", _FakeClient)
    out = llm.chat(conn, DAY, "comi 100g de arroz")
    assert out == {
        "reply": "Registrado: 100g de arroz.",
        "meals_logged": 1,
        "sets_logged": 0,
        "unmatched": [],
    }
    cap = _FakeClient.captured
    assert cap["api_key"] == "chave-teste"
    assert cap["model"] == llm.DEFAULT_MODEL
    assert "comi 100g de arroz" in cap["contents"]
    assert cap["config"].temperature == 0.0
    assert "<regras>" in cap["config"].system_instruction
    assert conn.execute("SELECT COUNT(*) FROM meals").fetchone()[0] == 1


def test_chat_sem_texto_na_resposta_e_modelo_por_env(conn, monkeypatch):
    class SilentClient(_FakeClient):
        def generate_content(self, *, model, contents, config):
            _FakeClient.captured = {"model": model}
            return SimpleNamespace(text=None)

    monkeypatch.setenv("GEMINI_API_KEY", "chave")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-experimental")
    monkeypatch.setattr(llm.genai, "Client", SilentClient)
    out = llm.chat(conn, DAY, "oi")
    assert out["reply"] == "Não consegui interpretar a mensagem."
    assert _FakeClient.captured["model"] == "gemini-experimental"
