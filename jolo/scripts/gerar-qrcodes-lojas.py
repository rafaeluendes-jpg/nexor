#!/usr/bin/env python3
"""QR Code de cada loja para o quadro da vitrine.

Cada QR leva para a landing com a loja marcada em utm_campaign
(qrcode-<cidade>). O CRM le essa marca e mostra "QR Code da loja de <cidade>"
na conversa, no lead e nos relatorios (packages/shared/src/origem.ts).

Uso: python3 jolo/scripts/gerar-qrcodes-lojas.py
Saida: jolo/docs/qrcode/lojas/<cidade>.pdf|.svg|.png
"""
import os
import sys

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

# Precisa bater com LOJAS_QRCODE em packages/shared/src/origem.ts
LOJAS = [
    ('santa-fe-do-sul', 'SFS', 'Santa Fé do Sul'),
    ('jales', 'JAL', 'Jales'),
    ('sorocaba', 'SOR', 'Sorocaba'),
    ('petropolis', 'PET', 'Petrópolis'),
    ('sao-paulo', 'SP', 'São Paulo'),
]
BASE = 'https://jologelato.com.br/?utm_source=loja&utm_medium=qrcode&utm_campaign=qrcode-'
COR = '#1F2D17'
BORDA = 4            # zona branca obrigatoria, em modulos
LADO_CM = 10.0       # tamanho do quadrado do QR no PDF
LEGENDA_CM = 1.6     # faixa com o nome da cidade embaixo

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'docs', 'qrcode', 'lojas')
FONTE_PNG = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def matriz(url):
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_H, border=0)
    q.add_data(url)
    q.make(fit=True)
    return q.get_matrix()


def caixa_central(n):
    """Quadrado branco no centro: ~22% do lado (cerca de 5% da area),
    bem abaixo dos 30% que a correcao H recupera."""
    lado = max(7, round(n * 0.22))
    if lado % 2 != n % 2:
        lado += 1
    ini = (n - lado) // 2
    return ini, lado


def corridas(m, ini, lado):
    """Modulos escuros juntados em faixas horizontais: um retangulo por
    faixa, sem emenda entre quadradinhos (a grafica nao ve riscos)."""
    for y, linha in enumerate(m):
        x = 0
        n = len(linha)
        while x < n:
            if linha[x] and not (ini <= x < ini + lado and ini <= y < ini + lado):
                x0 = x
                while x < n and linha[x] and not (ini <= x < ini + lado and ini <= y < ini + lado):
                    x += 1
                yield x0, y, x - x0
            else:
                x += 1


def gerar_svg(m, sigla, caminho):
    n = len(m)
    tot = n + 2 * BORDA
    ini, lado = caixa_central(n)
    partes = [f'M{x + BORDA},{y + BORDA}h{w}v1h-{w}z' for x, y, w in corridas(m, ini, lado)]
    cx = BORDA + ini
    tam = lado * (0.42 if len(sigla) > 2 else 0.5)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{LADO_CM}cm" height="{LADO_CM}cm" '
        f'viewBox="0 0 {tot} {tot}" shape-rendering="crispEdges">'
        f'<rect width="{tot}" height="{tot}" fill="#fff"/>'
        f'<path fill="{COR}" d="{"".join(partes)}"/>'
        f'<rect x="{cx + 0.5}" y="{cx + 0.5}" width="{lado - 1}" height="{lado - 1}" rx="1" '
        f'fill="#fff" stroke="{COR}" stroke-width="0.6"/>'
        f'<text x="{tot / 2}" y="{tot / 2}" font-family="Helvetica, Arial, sans-serif" font-weight="700" '
        f'font-size="{tam:.2f}" fill="{COR}" text-anchor="middle" dominant-baseline="central">{sigla}</text>'
        '</svg>\n'
    )
    with open(caminho, 'w', encoding='utf-8') as f:
        f.write(svg)


def gerar_pdf(m, sigla, cidade, caminho):
    n = len(m)
    tot = n + 2 * BORDA
    mod = LADO_CM * cm / tot
    alt = (LADO_CM + LEGENDA_CM) * cm
    c = canvas.Canvas(caminho, pagesize=(LADO_CM * cm, alt))
    c.setTitle(f'QR Code Jolô Gelato - {cidade}')
    c.setAuthor('Jolô Gelato')
    c.setFillColor('#ffffff')
    c.rect(0, 0, LADO_CM * cm, alt, stroke=0, fill=1)
    ini, lado = caixa_central(n)
    c.setFillColor(COR)
    topo = alt  # coordenadas do PDF crescem para cima
    # um caminho so com todas as faixas: a tinta e a uniao delas, sem fresta entre linhas
    caminho_qr = c.beginPath()
    for x, y, w in corridas(m, ini, lado):
        caminho_qr.rect((x + BORDA) * mod, topo - (y + BORDA + 1) * mod, w * mod, mod)
    c.drawPath(caminho_qr, stroke=0, fill=1, fillMode=1)
    # caixa e sigla no centro
    bx = (BORDA + ini + 0.5) * mod
    bl = (lado - 1) * mod
    by = topo - (BORDA + ini + 0.5) * mod - bl
    c.setFillColor('#ffffff')
    c.setStrokeColor(COR)
    c.setLineWidth(0.6 * mod)
    c.roundRect(bx, by, bl, bl, mod, stroke=1, fill=1)
    tam = lado * mod * (0.42 if len(sigla) > 2 else 0.5)
    c.setFillColor(COR)
    c.setFont('Helvetica-Bold', tam)
    c.drawCentredString(bx + bl / 2, by + bl / 2 - tam * 0.35, sigla)
    # nome da cidade na faixa de baixo
    c.setFont('Helvetica-Bold', 0.62 * cm)
    c.drawCentredString(LADO_CM * cm / 2, (LEGENDA_CM * cm) / 2 + 0.05 * cm, f'Jolô Gelato · {cidade}')
    c.showPage()
    c.save()


def gerar_png(m, sigla, caminho, px_mod=40):
    n = len(m)
    tot = n + 2 * BORDA
    img = Image.new('RGB', (tot * px_mod, tot * px_mod), 'white')
    d = ImageDraw.Draw(img)
    ini, lado = caixa_central(n)
    for y, linha in enumerate(m):
        for x, v in enumerate(linha):
            if v and not (ini <= x < ini + lado and ini <= y < ini + lado):
                x0, y0 = (x + BORDA) * px_mod, (y + BORDA) * px_mod
                d.rectangle([x0, y0, x0 + px_mod - 1, y0 + px_mod - 1], fill=COR)
    b0 = (BORDA + ini + 0.5) * px_mod
    b1 = (BORDA + ini + lado - 0.5) * px_mod
    d.rounded_rectangle([b0, b0, b1, b1], radius=px_mod, fill='white', outline=COR, width=max(2, int(0.6 * px_mod)))
    tam = int(lado * px_mod * (0.42 if len(sigla) > 2 else 0.5))
    fonte = ImageFont.truetype(FONTE_PNG, tam) if os.path.exists(FONTE_PNG) else ImageFont.load_default()
    d.text(((b0 + b1) / 2, (b0 + b1) / 2), sigla, fill=COR, font=fonte, anchor='mm')
    img.save(caminho, dpi=(300, 300))


def main():
    os.makedirs(SAIDA, exist_ok=True)
    for slug, sigla, cidade in LOJAS:
        url = BASE + slug
        m = matriz(url)
        gerar_svg(m, sigla, os.path.join(SAIDA, f'{slug}.svg'))
        gerar_pdf(m, sigla, cidade, os.path.join(SAIDA, f'{slug}.pdf'))
        gerar_png(m, sigla, os.path.join(SAIDA, f'{slug}.png'))
        print(f'{cidade}: {url}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
