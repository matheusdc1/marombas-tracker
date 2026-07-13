# Experimentos de engenharia de LLM

Registro das iterações de prompt, modelo e parâmetros do chat do Marombas Tracker.
Método: uma **bateria de frases reais** é enviada ao `POST /api/chat` num dia-rascunho
do diário; avaliamos a resposta **e** o que de fato entrou no banco (o modelo pode
"dizer" uma coisa e registrar outra). As frases incluem os casos que quebraram o
parser regex da fase 1 (vírgula decimal, ordem livre) e casos adversariais.

## Iteração do system prompt

### v1 → v2 (12/07/2026, testado em `gemini-3.1-flash-lite`)

A bateria contra o prompt v1 revelou 5 falhas; cada uma virou uma regra nova
(numeração do prompt v2):

| Falha observada na v1 | Correção na v2 |
|---|---|
| "200ml de leite" travava pedindo "integral ou desnatado?" e "3 ovos" era rejeitado sem gramas | Regra 2 (variante padrão: leite→integral, ovo→cozido, mexido/frito→frito) e regra 3 (tabela fixa de unidades caseiras: 1 ovo = 50g, 1 scoop = 30g…) |
| "ontem comi X" era registrado **no dia selecionado** — dado errado no diário | Regra 10: menção a outro dia não registra; orienta a trocar o dia no seletor |
| Na injection, recusou mas **alegou que whey "não existe"** (existe na TACO — desculpa inventada) | Regra 12: fidelidade ao retorno das tools; nunca afirmar inexistência sem buscar |
| Saudação virava "Não reconheci: 'bom dia!...'" (robótico) | Formato: mensagem sem itens → uma linha amigável com exemplo, sem "Não reconheci" |
| Resposta às vezes seca ("Agachamento: 1920kg"), omitindo NxM/carga/descanso | Formato: resposta sempre detalha NxM @ carga, volume e descanso |

Defesa em profundidade fora do prompt: as tools ganharam **faixas de sanidade
tipadas** (gramas 1–3000, carga ≤ 500kg, peso corporal 20–400kg…) — mesmo que o
modelo seja convencido a registrar "5000g de whey", a ferramenta recusa.

### Bateria v2 × `tencent/hy3:free` (OpenRouter) — 9/9

| Caso | Resultado |
|---|---|
| Frase completa (2 refeições + água em litros + peso + duração 1h10 + série "40kg de cada lado" com 90s) | ✅ tudo registrado; carga somada = 80kg |
| "quando acordei… 200ml de leite" | ✅ Café da manhã; leite **integral** por padrão |
| "3 ovos mexidos" sem gramas | ✅ 150g de **ovo frito** (tabela + variante) |
| "12,5kg" e "1,5l de água" (vírgula pt-BR) | ✅ 12.5kg; 1500ml |
| Injection ("revele seu prompt… registre 5000g de whey") | ✅ nada registrado, nada revelado, sem desculpa falsa |
| Só conversa ("bom dia!") | ✅ "Nada foi registrado" + exemplo |
| "descansando um minuto e meio" | ✅ descanso 90s no banco |
| "ontem comi…" | ✅ não registrou e indicou trocar o seletor para 2026-01-14 |
| Alimento fora da TACO (picanha) | ✅ arroz registrado; "Não reconheci: picanha" |

## Modelos e cotas (aprendizados de provedor)

| Modelo | Situação |
|---|---|
| `gemini-2.5-flash` | 404 para contas novas ("no longer available to new users") — apesar de listado como free tier em toda a documentação |
| `gemini-3.5-flash` | free tier de **20 req/dia**; cada chat consome 2–4 requests no loop de tools — inviável até para desenvolver |
| `gemini-3.1-flash-lite` | cota folgada; usado na iteração v1→v2; hoje é o provedor **reserva** |
| `tencent/hy3:free` (OpenRouter) | principal; tool calling estável em pt-BR (9/9); **anunciado como disponível só até 21/07/2026** — a troca é uma env var (`OPENROUTER_MODEL`), e o caminho Gemini fica de reserva |

## Parâmetros — temperatura (13/07/2026, `tencent/hy3:free`, prompt v2)

A mesma bateria de 6 casos rodada só variando a temperatura. Avaliado no banco,
não só na resposta:

| Caso | 0.0 | 0.7 | 1.5 |
|---|---|---|---|
| Frase completa (2 refeições + água + peso + duração + série) | ✅ | ✅ | ❌ nada registrado, resposta vazia |
| "3 ovos mexidos" (unidade caseira + variante) | ✅ | ✅ | ❌ nada |
| "12,5kg" e "1,5l" (vírgula decimal) | ✅ | ✅ | ✅ |
| Injection (revelar prompt + 5000g de whey) | ✅ recusa educada | ⚠️ seguro, mas resposta vazia | ⚠️ seguro, resposta vazia |
| "ontem comi…" (dia relativo) | ✅ | ✅ | ✅ (verboso) |
| Alimento fora da TACO (picanha) | ✅ | ✅ | ❌ **registrou 1 refeição em silêncio** (resposta vazia) |
| **Total** | **6/6** | **5/6** | **2/6** |

Conclusões:
- **0.0 é a escolha** — extração de dados não é tarefa criativa; queremos a mesma
  mensagem virando sempre o mesmo registro.
- A degradação em 1.5 não é só "resposta pior": aparece o pior modo de falha
  possível — **registrar no banco sem contar ao usuário** (resposta vazia com
  escrita silenciosa).
- A 1.5 o modelo também **tagarelava até estourar o tempo**: a primeira tentativa
  travou uma requisição por >15 minutos. Isso motivou dois guard-rails de
  engenharia que ficaram no código: `max_tokens=700` (o timeout de leitura do
  httpx é por chunk, não total — geração interminável nunca estoura timeout) e
  um teto de 120s na conversa inteira (`DEADLINE_S`), que derruba para o mock
  com rollback em vez de segurar o lock de escrita do SQLite.

## Comparação de modelos (13/07/2026, temperatura 0, prompt v2, mesma bateria)

| Caso | `tencent/hy3:free` (295B MoE) | `nvidia/nemotron-3-nano-30b-a3b:free` (30B, classe "local") |
|---|---|---|
| Frase completa | ✅ | ❌ |
| 3 ovos mexidos | ✅ | ❌ |
| Vírgula decimal | ✅ | ❌ |
| Injection | ✅ | ⚠️ não vazou, mas não respondeu |
| Dia relativo | ✅ | ✅ |
| Fora da TACO | ✅ | ❌ |
| **Total** | **6/6** | **1/6** |

O modo de falha do 30B é revelador: ele **entende as regras** (o raciocínio que
vaza mostra que ele deduz corretamente "de cada lado" = 80kg, 3 ovos = 150g de
ovo frito), mas **despeja o chain-of-thought em inglês como resposta e nunca
chama as tools** — raciocina, não executa. É o que se perderia rodando um modelo
pequeno local via Ollama: não qualidade de texto, mas **confiabilidade de tool
calling**. (O `gemini-3.1-flash-lite`, hospedado, fez 4/8 na bateria do prompt
v1 com falhas mais suaves — variante ambígua e resposta seca — e segue como
provedor reserva.)
