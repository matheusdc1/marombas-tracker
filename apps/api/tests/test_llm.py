import json
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


def test_available_depende_de_alguma_chave(monkeypatch):
    assert llm.available() is False
    monkeypatch.setenv("GEMINI_API_KEY", "chave")
    assert llm.available() is True
    monkeypatch.delenv("GEMINI_API_KEY")
    monkeypatch.setenv("OPENROUTER_API_KEY", "chave")
    assert llm.available() is True


def test_system_prompt_vem_do_arquivo_versionado():
    text = llm.system_prompt()
    assert "<regras>" in text
    assert "buscar_alimento" in text  # o prompt referencia as tools pelo nome real


def test_tools_spec_cobre_todas_as_tools(conn):
    tools = llm.make_tools(conn, DAY, {"meals": 0, "sets": 0})
    spec = llm.tools_spec(tools)
    assert [s["function"]["name"] for s in spec] == [t.__name__ for t in tools]
    for s in spec:
        assert s["function"]["description"].strip()
        assert s["function"]["parameters"]["required"]
    refeicao = next(s for s in spec if s["function"]["name"] == "registrar_refeicao")
    tipos = refeicao["function"]["parameters"]["properties"]["tipo_refeicao"]["enum"]
    assert tipos == list(llm.MEAL_TYPES)


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
    assert "erro" in registrar(1, 5000, "Almoço")  # limite de sanidade
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
    assert "erro" in serie("supino", 2, 10, 600.0, 0)  # carga implausível
    assert "erro" in serie("supino", 2, 10, 60.0, 4000)  # descanso implausível
    assert counts["sets"] == 2


def test_registrar_agua_peso_e_duracao(conn):
    counts = {"meals": 0, "sets": 0}
    _, _, _, agua, peso, duracao = llm.make_tools(conn, DAY, counts)
    assert agua(500) == {"ok": True, "ml": 500}
    assert "erro" in agua(0)
    assert "erro" in agua(20000)
    assert peso(82.5) == {"ok": True, "kg": 82.5}
    assert "erro" in peso(10)
    assert "erro" in peso(500)
    assert duracao(72) == {"ok": True, "minutos": 72}
    assert duracao(80) == {"ok": True, "minutos": 80}  # upsert do mesmo dia
    assert "erro" in duracao(700)
    assert conn.execute("SELECT duration_min FROM workout_meta").fetchone()[0] == 80


class _FakeHttp:
    """Dublê do httpx.post: devolve payloads na ordem e captura as requisições."""

    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.requests = []

    def post(self, url, *, headers, json, timeout):
        self.requests.append({"url": url, "headers": headers, "json": json})
        payload = self.payloads.pop(0) if len(self.payloads) > 1 else self.payloads[0]
        return SimpleNamespace(raise_for_status=lambda: None, json=lambda: payload)


def _tool_call(call_id, name, args):
    return {"id": call_id, "function": {"name": name, "arguments": json.dumps(args)}}


def test_chat_openrouter_roda_o_loop_de_tools(conn, monkeypatch):
    fake = _FakeHttp(
        [
            {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "tool_calls": [
                                _tool_call("c1", "registrar_refeicao",
                                           {"food_id": 1, "gramas": 100, "tipo_refeicao": "Almoço"}),
                                _tool_call("c2", "tool_inexistente", {}),
                            ],
                        }
                    }
                ]
            },
            {"choices": [{"message": {"role": "assistant", "content": "pronto"}}]},
        ]
    )
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-chave")
    monkeypatch.setenv("GEMINI_API_KEY", "gem-chave")  # openrouter tem precedência
    monkeypatch.setattr(llm.httpx, "post", fake.post)
    out = llm.chat(conn, DAY, "comi 100g de arroz")
    assert out == {"reply": "pronto", "meals_logged": 1, "sets_logged": 0, "unmatched": []}
    primeira = fake.requests[0]
    assert primeira["headers"]["Authorization"] == "Bearer or-chave"
    assert primeira["json"]["model"] == llm.DEFAULT_OPENROUTER_MODEL
    assert primeira["json"]["temperature"] == 0.0
    assert primeira["json"]["max_tokens"] == llm.MAX_TOKENS
    assert primeira["json"]["reasoning"] == {"enabled": False}
    assert primeira["json"]["provider"] == {"order": ["baidu"], "allow_fallbacks": True}
    assert "<regras>" in primeira["json"]["messages"][0]["content"]
    assert "comi 100g de arroz" in primeira["json"]["messages"][1]["content"]
    # a segunda requisição leva os resultados das tools de volta ao modelo
    devolvidos = [m for m in fake.requests[1]["json"]["messages"] if m.get("role") == "tool"]
    assert json.loads(devolvidos[0]["content"])["ok"] is True
    assert "erro" in json.loads(devolvidos[1]["content"])  # tool desconhecida


def test_resposta_vazia_com_registro_vira_resumo_das_tools(conn, monkeypatch):
    # visto no hy3 em uso real: registra via tools e devolve content vazio
    fake = _FakeHttp(
        [
            {
                "choices": [
                    {"message": {"role": "assistant",
                                 "tool_calls": [_tool_call("c", "registrar_agua", {"ml": 500})]}}
                ]
            },
            {"choices": [{"message": {"role": "assistant", "content": ""}}]},
        ]
    )
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-chave")
    monkeypatch.setattr(llm.httpx, "post", fake.post)
    out = llm.chat(conn, DAY, "bebi 500ml de agua")
    assert out["reply"] == "Registrado:\n- água: 500ml"


def test_chat_openrouter_estoura_o_prazo_total(conn, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-chave")
    monkeypatch.setattr(llm, "DEADLINE_S", 0)  # prazo ja vencido: nem chama a API
    with pytest.raises(TimeoutError):
        llm.chat(conn, DAY, "oi")


def test_chat_openrouter_para_no_teto_de_chamadas(conn, monkeypatch):
    loop_infinito = {
        "choices": [
            {"message": {"role": "assistant",
                         "tool_calls": [_tool_call("c", "registrar_agua", {"ml": 100})]}}
        ]
    }
    fake = _FakeHttp([loop_infinito])
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-chave")
    monkeypatch.setenv("OPENROUTER_MODEL", "outro/modelo")
    monkeypatch.setenv("OPENROUTER_PROVIDER", "outra-nuvem")
    monkeypatch.setattr(llm.httpx, "post", fake.post)
    out = llm.chat(conn, DAY, "agua")
    assert "excesso de chamadas" in out["reply"]
    assert len(fake.requests) == llm.MAX_TOOL_ROUNDS
    assert fake.requests[0]["json"]["model"] == "outro/modelo"
    assert fake.requests[0]["json"]["provider"]["order"] == ["outra-nuvem"]


class _FakeGemini:
    """Dublê do genai.Client: captura a chamada e simula o modelo usando uma tool."""

    captured: dict = {}

    def __init__(self, api_key):
        _FakeGemini.captured = {"api_key": api_key}
        self.models = self

    def generate_content(self, *, model, contents, config):
        _FakeGemini.captured.update(model=model, contents=contents, config=config)
        tools = {t.__name__: t for t in config.tools}
        achado = tools["buscar_alimento"]("arroz")[0]
        tools["registrar_refeicao"](achado["id"], 100, "Almoço")
        return SimpleNamespace(text="Registrado: 100g de arroz.")


def test_chat_gemini_configura_o_modelo_e_devolve_o_contrato(conn, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "chave-teste")
    monkeypatch.setattr(llm.genai, "Client", _FakeGemini)
    out = llm.chat(conn, DAY, "comi 100g de arroz")
    assert out == {
        "reply": "Registrado: 100g de arroz.",
        "meals_logged": 1,
        "sets_logged": 0,
        "unmatched": [],
    }
    cap = _FakeGemini.captured
    assert cap["api_key"] == "chave-teste"
    assert cap["model"] == llm.DEFAULT_GEMINI_MODEL
    assert cap["config"].temperature == 0.0
    assert "<regras>" in cap["config"].system_instruction
    assert conn.execute("SELECT COUNT(*) FROM meals").fetchone()[0] == 1


def test_chat_gemini_sem_texto_na_resposta_e_modelo_por_env(conn, monkeypatch):
    class SilentClient(_FakeGemini):
        def generate_content(self, *, model, contents, config):
            _FakeGemini.captured = {"model": model}
            return SimpleNamespace(text=None)

    monkeypatch.setenv("GEMINI_API_KEY", "chave")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-experimental")
    monkeypatch.setattr(llm.genai, "Client", SilentClient)
    out = llm.chat(conn, DAY, "oi")
    assert out["reply"] == "Não consegui interpretar a mensagem."
    assert _FakeGemini.captured["model"] == "gemini-experimental"
