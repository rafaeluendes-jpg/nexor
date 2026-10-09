# QR Code das lojas

Leva para https://jologelato.com.br com a marca de origem
`utm_source=loja`, `utm_medium=qrcode`, `utm_campaign=vitrine`: o lead que
chega por ele aparece no CRM como vindo da loja.

- `qrcode-lojas.png` — 2280 px, para impressão até ~19 cm a 300 dpi
- `qrcode-lojas.pdf` — vetor, 10 x 10 cm, amplia sem perder qualidade (gráfica)
- `qrcode-lojas.svg` — o mesmo vetor, para Canva/Illustrator/Corel

Correção de erro alta (H): lê mesmo com reflexo ou um pedaço coberto.
Imprima com no mínimo 3 cm de lado e deixe a borda branca em volta.

## Um QR Code por loja (`lojas/`)

Cada loja tem o seu, com a sigla no meio e a cidade embaixo. O lead que
chega por ele aparece no CRM como **"QR Code da loja de <cidade>"** (conversa,
lead, funil) e como **"QR Code <cidade>"** no relatório por campanha.

| Loja | Sigla | Marca (utm_campaign) |
|---|---|---|
| Santa Fé do Sul | SFS | `qrcode-santa-fe-do-sul` |
| Jales | JAL | `qrcode-jales` |
| Sorocaba | SOR | `qrcode-sorocaba` |
| Petrópolis | PET | `qrcode-petropolis` |
| São Paulo | SP | `qrcode-sao-paulo` |

- `lojas/<cidade>.pdf`: vetor, 10 x 11,6 cm com o nome da cidade, para a gráfica
- `lojas/<cidade>.svg`: só o QR, vetor, para Canva/Illustrator/Corel
- `lojas/<cidade>.png`: 2440 px

Para gerar de novo: `python3 jolo/scripts/gerar-qrcodes-lojas.py`. Loja nova
entra na lista do gerador **e** em `packages/shared/src/origem.ts`; o teste
`tests/unit/origem-qrcode.spec.ts` reprova se as duas listas não baterem.
