# JOIA — Testes e Regressão

Como a proteção do Joia roda, o que cada camada cobre, e o que é preciso
para rodá-la. Companheiro do `JOIA_PROTOCOLO_PERMANENTE_DE_ENGENHARIA.md`.

## Como rodar

| Comando | O que faz |
|---|---|
| `npm test` | A bateria inteira — 56 suítes de `testes/` (unitário, integração, regressão). Elas leem as funções de dentro do `index.html` e rodam as de verdade. |
| `node ferramentas/portao.js` | O **portão de publicação**: as 9 etapas na ordem (montagem, versão, bateria, configurações, nuvem, varredura, auditoria visual, provas, persistência). Para na 1ª reprovação. É a regressão completa. |
| `node ferramentas/provar.js` | E2E no Chromium: abre caixa, vende, recarrega, fecha, exporta, permissão por perfil. Salva fotos em `/tmp/provas`. |
| `node ferramentas/auditar.js` | Auditoria visual no Chromium a 1440 e 390: zero erro de console, zero rolagem horizontal, zero alvo pequeno, zero texto técnico. |
| `node ferramentas/persistir.js` | Persistência real da taxa de cartão: salva → sai → F5 → troca módulo → versão nova → semente. |
| `node ferramentas/conferir-nuvem.js` | Campo a campo: o que o código manda × o que o banco de produção aceita. |
| `node ferramentas/auditar-configuracoes.js` | Nenhuma rotina apaga o que a loja configurou. |
| `node ferramentas/varrer.js` | As 94 telas montam; todo botão tem função; zero erro no clique. |

## Ambiente esperado

- Node instalado; `npm install` feito.
- Chromium para as provas/auditoria (já presente no ambiente em
  `/opt/pw-browsers`); as etapas de Chromium rodam com a **nuvem
  desligada** — não tocam produção.
- `conferir-nuvem.js` lê o esquema de `ferramentas/esquema-nuvem.json`;
  depois de qualquer migration, regrave-o com a consulta no fim do próprio
  arquivo.

## Cobertura por domínio

As 56 suítes de `testes/`, agrupadas pelo que protegem:

- **Login / sessão / segurança**: `login-nao-apaga-configuracao`,
  `login-sempre-aparece`, `sessao`, `reconexao`, `sosia`, `tenant`,
  `semsenha`.
- **PDV / caixa**: `caixa-nao-reabre`, `fechamento-nao-some`, `sangria-nao-some`,
  `turno`, `gelato`, `rascunho`, `papel`, `dia1`.
- **Pagamento / taxa**: `formas`, `persistir.js` (sentinela da taxa).
- **Estoque / ficha**: `contagem-nao-se-perde`, `contagem-sobe-inteira`,
  `baixa-manual-encontra-e-cadastra`, `saldo`, `vinculo`, `ligacoes`.
- **Pedido de base (matriz↔loja)**: `pedido-base-sobe-inteiro`.
- **Sincronização / nuvem**: `aparelho-atrasado-nao-manda`,
  `download-velho-nao-apaga-edicao`, `contador-nao-mente`, `reconciliacao`,
  `conferir-nuvem`, `envio`, `salvar`, `exclusao`.
- **Relatórios / canais**: `canais-e-horarios`, `bairro`, `avisozap`.
- **Service Worker / versão**: `versao`, `arranque`, `montagem`.
- **Visual / UX**: `bases-nao-treme`, `congela`, `rolagem`, `ux`,
  `varrer.js`, `auditar.js`.

## As regras da bateria

1. **Bug corrigido vira suíte** — cada arquivo em `testes/` nasceu de um
   estrago real; ele reproduz o defeito e falha se ele voltar.
2. **Prova, não impressão** — vale "antes o defeito acontece, depois não";
   não vale "a função existe" nem "compilou".
3. **Teste não se maquia** — nunca `skip`, nunca baixar `assert`, nunca
   trocar o esperado só para ficar verde. Regra de negócio só muda por
   ordem do Rafael.
4. **Nada de teste destrutivo em produção** — as provas rodam com a nuvem
   desligada; leitura de produção só para conferência (nunca escrita sem
   ordem).

## Antes de publicar

`node ferramentas/portao.js` verde nas 9 etapas. Qualquer outro resultado:
não publique. E mesmo verde, publicar é decisão do Rafael (exceção:
correção de defeito já publicado).
