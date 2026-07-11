# 🏋️ Marombas Tracker

> **App no ar:** https://marombastracker.up.railway.app/
> (frontend e API hospedados no Railway; dados de demonstração já carregados)

Tracker de dieta e treino para marombas: você descreve **em linguagem natural** o que comeu
e o treino que fez, e o sistema calcula calorias/macronutrientes (base: **tabela TACO**) e
registra o treino em tabelas com progressão de cargas e gráfico de evolução.

> Projeto individual da Avaliação Intermediária de IA Generativa (SENAI).
> **Nesta fase não há LLM integrado** — onde a IA atuará (interpretar a mensagem via MCP +
> adapter GLM/DeepSeek), há um **parser mock por regex** que simula a resposta estruturada.

## O problema e a solução

Quem treina e controla dieta faz hoje 3 tarefas manuais e chatas: procurar cada alimento na
tabela TACO e calcular macros por regra de três; anotar treino (exercícios, séries, cargas,
reps) em planilha; e acompanhar se a carga está progredindo. O Marombas Tracker junta tudo
num fluxo só:

```
"hoje comi 200g de frango, 100g de arroz cru, 30g de azeite, 350ml de leite e 30g de whey.
 treinei fullbody, 2 séries de supino reto 30kg de cada lado 10 reps, ..."
        │
        ▼  (fase atual: parser mock por regex — fase final: LLM via MCP)
   refeições estruturadas + séries estruturadas
        │
        ▼
   SQLite (TACO + diário + treino)  →  relatório do dia, calendário, gráfico de volume
```

### Telas

| Aba | O que tem |
|-----|-----------|
| **Chat** | conversa em linguagem natural; a resposta (simulada) mostra o que foi registrado, com kcal, macros e avisos de novo PR |
| **Diário** | seletor de dia, tiles com metas e barras de progresso (kcal/proteína/carbo/gordura/água + calorias restantes), refeições agrupadas por horário com totais, treino com duração, descanso, badge de PR e edição inline |
| **Evolução** | gráficos por métrica (volume, peso corporal, calorias, proteína, água, carga por exercício) com períodos de 7/30/90/365 dias, registro de peso com inicial/atual/diferença e histórico de PRs |
| **Fotos** | fotos de evolução física (upload local) em Frente/Lado/Costas, linha do tempo por data e comparação lado a lado de duas fotos |

### Como a IA entra no futuro

O endpoint `POST /api/chat` hoje chama `app/parser.py` (regex). Na fase final, esse módulo
será substituído por uma chamada a um LLM (GLM/DeepSeek ou outro adapter) via **MCP**, que
devolverá o mesmo formato estruturado `{meals, sets, unmatched}` — o resto do sistema
(banco, relatórios, UI) já está pronto para isso. O contrato mock = contrato real é
deliberado: trocar o parser não toca em mais nada.

## Stack e arquitetura

- **Monorepo npm workspaces**: `apps/api` (Python 3.12 + FastAPI + SQLite stdlib) e
  `apps/web` (React 19 + Vite + TypeScript).
- **SQLite** (recomendação do professor): um arquivo, zero configuração, seed automático.
- Testes: `pytest` + `pytest-cov` no backend; `vitest` + Testing Library no frontend.

```
apps/
  api/
    app/            # db.py, parser.py (mock do LLM), routes.py, taco_seed.py
    tests/
  web/
    src/            # App, Chat, Diario, Evolucao, LineChart + testes co-localizados
scripts/gate.py     # gate de qualidade (ver abaixo)
.githooks/          # pre-commit e pre-push executam o gate
```

### API

| Método | Rota | O que faz |
|--------|------|-----------|
| GET | `/api/foods?q=` | busca na tabela TACO (54 alimentos curados) |
| POST | `/api/foods` | cadastra alimento custom (ex.: hipercalórico) |
| GET | `/api/log/{dia}` | relatório do dia: refeições + treino + totais |
| POST/PUT/DELETE | `/api/log/{dia}/meals`, `/api/meals/{id}` | CRUD completo de refeições |
| POST/PUT/DELETE | `/api/log/{dia}/sets`, `/api/sets/{id}` | CRUD completo de séries |
| GET/PUT | `/api/goals` | metas diárias (kcal, proteína, carbo, gordura, água) |
| POST | `/api/log/{dia}/water`, PUT `/api/log/{dia}/workout` | água e duração do treino |
| GET | `/api/metrics?metric=&days=&exercise=` | séries temporais p/ os gráficos |
| GET/POST | `/api/prs`, `/api/weight` | histórico de PRs e peso corporal |
| POST/GET/DELETE | `/api/photos` (+ `/api/photos/file/{arquivo}`) | fotos de evolução (upload local) |
| POST | `/api/chat` | **mock do LLM**: interpreta a mensagem, registra e responde |

Dados de demonstração (~2 semanas de diário e treinos com progressão de carga):

```sh
cd apps/api && .venv\Scripts\python -m app.demo   # use --force para repovoar
```

## Gate de qualidade (harness)

`scripts/gate.py` roda automaticamente no **pre-commit** e no **pre-push** (hooks
versionados em `.githooks/`, ativados pelo script `prepare` do `npm install`). Reprovou,
**bloqueia**:

1. **Máx. 500 LOC produtivas por arquivo** (linhas não-vazias).
2. **Linhas de teste não contam** — arquivos de teste são ignorados por inteiro e testes
   inline (funções `test_*`/classes `Test*` em Python, blocos `describe/it/test` em JS/TS)
   são descontados da contagem.
3. **Cobertura mínima de 95%** no backend (`--cov-fail-under=95`) e no frontend
   (thresholds do vitest em linhas, funções e branches). Hoje: **100% nos dois**.

Manual: `npm run gate` · só LOC: `python scripts/gate.py --loc-only` ·
auto-teste do contador: `python scripts/gate.py --self-check`.

## Como rodar

```sh
npm install                 # deps do frontend + ativa os hooks do gate

# backend (uma vez): criar venv e instalar deps
cd apps/api && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt && cd ..\..

npm run dev:api             # FastAPI em http://localhost:8000
npm run dev:web             # Vite em http://localhost:5173 (proxy /api -> :8000)
```

## Documentação do processo (avaliação)

Desenvolvido com **Claude Code** (agente de codificação da Anthropic), em sessões iterativas.

### Escolhas de design

- **Monorepo sem Turborepo**: cogitei Turborepo, mas com um único app JS e um app Python
  (que o Turborepo nem orquestra) ele só adicionaria configuração. npm workspaces bastou.
- **Parser mock com o mesmo contrato do LLM futuro** (`{meals, sets, unmatched}`), para a
  troca ser cirúrgica na fase final.
- **Hooks versionados em `.githooks/`** (via `core.hooksPath`) em vez de `.git/hooks`,
  para o gate viajar com o repositório.
- **Gráfico SVG feito à mão** (sem lib de chart): uma série só não justifica dependência;
  o agente seguiu uma skill de dataviz com paleta validada para daltonismo/contraste,
  tooltip + crosshair e tabela de dados como camada de acessibilidade.
- **TACO como subconjunto curado** (54 alimentos comuns de dieta de treino, por 100g) em
  vez da tabela completa (~600 itens) — suficiente para o protótipo; a tabela completa
  entra depois como importação. Whey e pasta de amendoim não são TACO (valores de rótulo).

### O que funcionou

- **Scaffold completo em uma sessão**: monorepo, gate com hooks, backend e frontend com
  100% de cobertura, tudo commitado com o gate rodando de verdade a cada commit.
- **O gate pegou o que devia**: testado com um arquivo de 501 linhas (reprovou e bloqueou)
  e com a suíte real (aprovou).
- **Prompt que deu certo**: dar ao agente a *mensagem de exemplo real* ("hoje comi 200g de
  frango...") e exigir que ela virasse um teste de aceitação — o teste do parser cobre a
  frase inteira e foi ele que pegou o bug mais interessante do projeto (abaixo).
- O agente instalou sozinho Node e Python via winget quando descobriu que a máquina não
  tinha nenhum dos dois.

### O que não funcionou / precisou de intervenção

- **Bug real de regex com pt-BR**: "12,5kg" — a vírgula decimal brasileira era confundida
  com separador de lista e a série perdia carga e reps. O teste unitário pegou; o conserto
  foi permitir `[,.](?=\d)` no delimitador. Ficou registrado como lição do projeto.
- **Parser rígido demais na ordem da frase**: a primeira versão só entendia
  "N séries de exercício..." (o formato do exemplo da spec). Em uso real, "supino 3 séries
  de 12", "remada 3x8 40kg" e "4 séries supino" eram descartados **em silêncio** — só as
  refeições registravam. Foi reescrito por cláusulas (ordem independente + notação NxM) e
  o que não é reconhecido agora aparece como "não reconheci" na resposta do chat.
- **Bug que 100% de cobertura não pegou**: `sqlite3.ProgrammingError` intermitente no
  uvicorn — o FastAPI roda dependency e endpoint sync em threads diferentes do pool, e o
  TestClient (mesma thread) nunca reproduz. Conserto: `check_same_thread=False` + teste de
  regressão que cruza threads. Lição: suíte verde ≠ servidor real testado.
- **jsdom não entrega `clientX` em `fireEvent.pointerMove`**: o teste de hover do gráfico
  passou "por sorte" na primeira asserção (tudo era coordenada 0) e falhou na segunda. Foi
  preciso despachar `MouseEvent('pointermove', {clientX})` manualmente e usar `pointerOut`.
- **Texto duplicado nos testes de UI**: "frango grelhado" existia na tabela *e* no
  `<select>` de alimentos; `getByText` quebrou e foi trocado por `getByRole('cell')`.
- **PowerShell 5.1**: aspas duplas dentro de here-string quebraram `git commit -m` (a
  mensagem virou argumentos soltos); mensagens de commit tiveram que evitar `"` .
- **Cobertura de 95% em branches** guiou o design: o agente precisou simplificar
  condicionais dos componentes (menos ternários, estados explícitos) para cada branch ser
  testável — efeito colateral positivo do gate.

### Uso do agente de codificação

Praticamente 100% do código foi gerado pelo Claude Code com supervisão; o histórico de
commits (um por fase, com o gate aprovando cada um) documenta a progressão. Exemplos de
prompts usados:

1. *"crie o setup do projeto e também crie uma mini harness gate (script) que valide 500
   LOC por arquivo, 95% de cobertura, linhas de teste não contam, monorepo React+FastAPI"*
   — gerou o esqueleto e o `gate.py` com self-check.
2. *"faça todos os próximos passos naturais"* — backend TACO + parser mock + telas + testes.
3. A mensagem de exemplo do usuário final virou fixture de teste de aceitação do parser.
