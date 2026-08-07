# Nexor — Arquitetura

Documento para avaliação técnica. Estado em 06/08/2026, versão V17.2.1.

## O que é

SaaS de gestão para food service e redes de franquia. Multi-loja, multi-rede,
com sincronização em nuvem e operação offline.

Em produção hoje: 6 lojas da rede Jolô Gelato. Plano: 60 unidades.

## Números

| | |
|---|---|
| JavaScript | ~19.800 linhas, ~1.000 funções |
| CSS | ~10.900 linhas |
| Arquivo do sistema | 1,65 MB (`index.html`) |
| Tabelas no banco | 41 sincronizadas + auxiliares |
| Testes automatizados | 32 suítes, ~810 asserções |

## Stack

**Frontend / aplicação** — arquivo único `index.html`. Sem framework, sem
build, sem dependências. JavaScript puro (ES2017+), CSS com custom properties.

**Persistência local** — `localStorage`. O sistema opera 100% offline; a nuvem
é sincronização, não requisito.

**Nuvem** — Supabase (PostgreSQL + PostgREST + Realtime + RLS).
Autenticação por senha com hash; isolamento por loja via Row Level Security.

**Robô do WhatsApp** — serviço Node.js separado (`nexor-whatsapp`), Baileys,
hospedado no Render. Lê o mesmo banco. IA via Groq/Gemini.

**Hospedagem** — GitHub Pages (`rafaeluendes-jpg/nexor`).

**CI** — nenhum. Testes rodam localmente com jsdom antes de cada publicação.

## Sincronização

O ponto mais trabalhado do sistema. Modelo:

- **Envio incremental** por hash de conteúdo (`DB._hash`, `DB._uuid`)
- **Identificador local** (`ref_local`) mapeado para UUID do banco; upsert por
  `on_conflict=ref_local`
- **Contador de versão por loja** (`loja_versao`, 41 gatilhos) — a conferência
  periódica lê 1 linha em vez de 41 tabelas
- **Realtime** para propagação imediata + conferência a cada 45s como rede

### Proteções contra perda de dado

Cada uma foi escrita depois de um incidente real:

1. **Download atômico** — monta tudo em memória; falha no meio não altera nada
2. **Trava de exclusão em massa** — bloqueia se >60% dos registros sumiriam
3. **Registro novo não confirmado** não é apagado por download
4. **Vínculo cheio ganha de vínculo vazio** — a nuvem não apaga uma ligação que
   existe no aparelho; agenda reenvio
5. **Troca de formato de identificador** não é lida como exclusão
6. **Igualação de chaves** antes do envio (PostgREST exige o mesmo jogo de
   chaves em todo o lote)
7. **Falha isolada x sistêmica** — 1-2 tabelas com erro não param o aparelho;
   metade delas mantém a pendência marcada

## Módulos

PDV, Estoque (ficha técnica, composição, contagem, movimentação, notas de
entrada, produção), Financeiro (lançamentos, conciliação bancária, contas,
categorias por tipo), Cardápio digital, Delivery e entregadores, Clientes,
Cupons, Relatórios, Configuração, Assistente Nexor.

## Pontos que um revisor deve questionar

Listados de propósito — são as decisões discutíveis:

- **Arquivo único de 1,65 MB.** Sem modularização, sem bundler, sem tree
  shaking. Facilita o deploy e a operação offline; dificulta manutenção em
  equipe e revisão de código.
- **CSS duplicado em duas folhas** — a segunda sobrescreve a primeira. Herança
  histórica; toda alteração de estilo precisa ir nas duas.
- **Sem tipagem.** JavaScript puro, sem TypeScript.
- **Sem CI.** Os testes existem e são executados, mas manualmente.
- **Autenticação própria** em vez de Supabase Auth.
- **GitHub Pages** como hospedagem — instável na prática (falhas intermitentes
  de publicação, sem log de erro).
- **Robô do WhatsApp via Baileys** — biblioteca não oficial. Migração para a
  Cloud API da Meta está planejada.

## Onde está o código

- Sistema: `github.com/rafaeluendes-jpg/nexor` → `index.html`
- Robô: `github.com/rafaeluendes-jpg/nexor-whatsapp` → `server.js`
- Decisões de projeto e histórico: `DECISOES.md` neste repositório
