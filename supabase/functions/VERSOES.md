# Edge Functions — cópia do código publicado

Origem: projeto Supabase `cevghkndzpzvnzwifhnm` ("Joia Gestão Inteligente"),
lido em 02/10/2026 com `get_edge_function` (somente leitura). Cada pasta tem
os arquivos exatamente como estão publicados, byte a byte. Serve para
republicar em outro servidor; nada foi alterado no Supabase.

As pastas `central-painel`, `criar-usuario`, `joia-api`, `joia-fiscal` e
`joia-rds` já existiam e não fazem parte desta cópia.

| Slug | Versão publicada | verify_jwt | O que faz | Pertence a |
|---|---|---|---|---|
| `nexor` | 1 | false | Protótipo de demonstração "Nexor" (nome antigo do ERP): serve HTML + CSS + JS com dados fictícios e login falso só no navegador (4 arquivos: `index.ts`, `styles.ts`, `config.ts`, `app.ts`). | Joia ERP (protótipo) |
| `teste` | 1 | false | Página HTML fixa "TESTE OK", para conferir que a hospedagem responde. | Joia ERP (teste de hospedagem) |
| `app` | 2 | false | Entrega a interface da plataforma lendo `index.html` e logos do balde público `mkt-site`, com o tipo de conteúdo correto. | Marketing |
| `analisar` | 10 | true | Analisa uma imagem de material contra as regras vigentes do manual da marca: mede cor/exposição/nitidez/proporção no pixel, pede leitura ao Claude e calcula a nota de forma determinística; grava em `mkt.analises`. | Marketing |
| `analisar-video` | 3 | true | Mesma análise para vídeo, a partir de quadros já extraídos no navegador (balde `mkt-materiais`); achados com instante e roteiro de edição. Aceita chamada interna da `fila-video`. | Marketing |
| `gerar-arte` | 6 | true | Monta arte em SVG por regra (cores e logo oficiais do balde `mkt-site`, foto opcional do material); o Claude só escreve a frase, que passa por conferência do manual. | Marketing |
| `ingerir-manual` | 2 | true | Ingere o PDF do manual da marca (texto por página ou OCR via Claude a partir do balde `mkt-manuais`), cria nova versão do manual e grava regras como "sugeridas". Só admin. | Marketing |
| `corrigir-imagem` | 4 | true | Correção automática de imagem (exposição, contraste, saturação, temperatura, recorte), gravada como nova versão "corrigido" no balde `mkt-materiais`, sem sobrescrever o original. | Marketing |
| `admin-usuarios` | 2 | true | Administração de unidades e usuários do esquema `mkt` (criar/suspender unidade, desativar/reativar, trocar papel, mover, redefinir senha), com registro em `mkt.audit_log`. | Marketing |
| `fila-video` | 1 | true | Fila assíncrona de análise de vídeo (`enfileirar`, `processar`, `estado`); o processamento chama a `analisar-video`. | Marketing |
| `legendas` | 2 | true | Ciclo de legendas (gerar com Claude + conferência por regra, editar, aprovar/recusar), configuração de tom da marca e referências. | Marketing |
| `painel` | 1 | false | Tela "Analista de Marca" (HTML + JS) servida pelo Supabase: login, lista e envio de materiais, botões de analisar e corrigir. | Marketing |

## Variáveis de ambiente usadas

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — fornecidas
  automaticamente pelo Supabase; em outro servidor precisam ser definidas.
- A chave da IA (Anthropic) não está no código: as funções de marketing a
  leem do banco pela RPC `mkt.chave_ia`.

## Observações de segurança

Nenhum segredo precisou ser trocado. Dois valores fixos no código, deixados
como estão porque são públicos de propósito:

- `painel/index.ts` tem a URL do projeto e a chave **publishable**
  (`sb_publishable_…`), que é a chave pública de navegador (equivale à anon).
  Ao republicar em outro projeto, trocar as duas.
- `nexor/app.ts` tem um login de demonstração fixo, conferido só no navegador
  e escrito na própria tela. Não protege nada nem dá acesso a dado real.
