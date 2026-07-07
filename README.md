# Marombas Tracker

Tracker de dieta e treino para marombas: você descreve em linguagem natural o que comeu
e o treino que fez, e o sistema calcula calorias/macronutrientes (base: **tabela TACO**)
e registra o treino em tabelas com progressão de cargas.

> Projeto individual da Avaliação Intermediária de IA Generativa (SENAI).
> **Nesta fase não há LLM integrado** — onde a IA atuará (interpretar a mensagem do
> usuário via MCP + adapter GLM/DeepSeek), as respostas são simuladas (mock).

## O problema e a solução

Quem treina e controla dieta precisa de: consulta à tabela TACO, cálculo de macros,
diário por dia (com calendário), registro de treino (exercícios, séries, cargas, reps)
e acompanhamento de progressão de carga (volume total em kg) num gráfico.

Fluxo alvo (com IA, fase futura): o usuário escreve
*"hoje comi 200g de frango, 100g de arroz cru, 30g de azeite... treinei fullbody,
2 séries de supino 30kg de cada lado 10 reps..."* e o LLM (via MCP) estrutura isso em
refeições + exercícios; o backend consulta a TACO e persiste tudo em SQLite.

## Stack e arquitetura

- **Monorepo**: `apps/api` (Python + FastAPI + SQLite) e `apps/web` (React + Vite + TypeScript).
- npm workspaces simples — **sem Turborepo**: com um único app JS e um app Python,
  o Turborepo só adicionaria configuração sem ganho real de cache/pipeline.
- Testes: `pytest` + `pytest-cov` no backend, `vitest` + Testing Library no frontend.

```
apps/
  api/          # FastAPI (app/) + testes (tests/)
  web/          # React + Vite (src/) + testes co-localizados (*.test.tsx)
scripts/
  gate.py       # gate de qualidade (ver abaixo)
.githooks/      # pre-commit e pre-push que executam o gate
```

## Gate de qualidade (harness)

`scripts/gate.py` roda automaticamente no **pre-commit** e no **pre-push**
(hooks versionados em `.githooks/`, ativados por `git config core.hooksPath .githooks`
— o `npm install` na raiz já faz isso via script `prepare`). Se qualquer regra falhar,
o commit/push é **bloqueado**:

1. **Máx. 500 LOC produtivas por arquivo** (linhas não-vazias).
2. **Linhas de teste não contam** — arquivos de teste (`test_*.py`, `*.test.tsx`,
   pastas `tests/`/`__tests__/`) são ignorados; em arquivos mistos, blocos de teste
   inline (funções `test_*`/classes `Test*` em Python, `describe/it/test` em JS/TS)
   são descontados da contagem.
3. **Cobertura mínima de 95%** no backend (`--cov-fail-under=95`) e no frontend
   (thresholds do vitest).

Rodar manualmente: `npm run gate` (ou `python scripts/gate.py`).
Só a checagem de LOC: `python scripts/gate.py --loc-only`.
Auto-teste da lógica de contagem: `python scripts/gate.py --self-check`.

## Como rodar

```sh
# raiz — instala deps do frontend e ativa os hooks do gate
npm install

# backend
cd apps/api
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# frontend (outro terminal, na raiz)
npm run dev:web   # http://localhost:5173 (proxy /api -> :8000)
```

## Documentação do processo (avaliação)

### Escolhas de design
- Monorepo sem Turborepo (justificativa acima).
- Hooks versionados em `.githooks/` em vez de `.git/hooks` para o gate viajar com o repo.
- Gate em Python puro (stdlib): usa `ast` para descontar testes inline em Python e um
  rastreador simples de chaves/parênteses para JS/TS.
- SQLite como banco (recomendação do professor; zero configuração).

### O que funcionou
_(preencher durante o desenvolvimento — anotar prompts que deram bom resultado)_

### O que não funcionou
_(preencher durante o desenvolvimento — falhas do agente, intervenções manuais)_

### Uso do agente de codificação
Projeto desenvolvido com **Claude Code**. _(anotar prompts/iterações relevantes)_
