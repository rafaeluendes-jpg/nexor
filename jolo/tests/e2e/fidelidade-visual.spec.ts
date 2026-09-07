import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { URLS } from '../playwright.config';

/**
 * A pagina aprovada e a referencia (legacy/landing-approved.html).
 * Este teste compara bloco a bloco a pagina servida com ela: mesma
 * quantidade de blocos, mesmas classes, mesma posicao e mesma altura.
 * Se alguem mexer no visual sem ordem, isto reprova.
 */
const APROVADA = resolve(__dirname, '../../legacy/landing-approved.html');

interface Bloco {
  tag: string;
  cls: string;
  top: number;
  h: number;
}

/** Roda dentro do navegador: mede cada bloco da pagina. */
function medirBlocos(): Bloco[] {
  const saida: Bloco[] = [];
  document.querySelectorAll('section, header, footer, .container > *').forEach((el) => {
    const r = el.getBoundingClientRect();
    saida.push({
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === 'string' ? el.className : '',
      top: Math.round(r.top + window.scrollY),
      h: Math.round(r.height),
    });
  });
  return saida;
}

const TELAS = [
  { nome: 'computador', width: 1440, height: 900 },
  { nome: 'tablet', width: 834, height: 1112 },
  { nome: 'celular', width: 390, height: 844 },
];

// tolerancia de 2px: arredondamento de fonte entre uma carga e outra
const TOLERANCIA = 2;

for (const tela of TELAS) {
  test(`a pagina servida e igual a aprovada no ${tela.nome}`, async ({ browser }) => {
    expect(existsSync(APROVADA), `pagina aprovada nao encontrada em ${APROVADA}`).toBe(true);

    const contexto = await browser.newContext({
      viewport: { width: tela.width, height: tela.height },
      reducedMotion: 'reduce',
    });
    const pagina = await contexto.newPage();

    const medir = async (endereco: string) => {
      await pagina.goto(endereco, { waitUntil: 'networkidle' });
      // as animacoes de entrada nao podem mascarar diferenca de altura
      await pagina.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('show')));
      await pagina.waitForTimeout(400);
      return pagina.evaluate(medirBlocos);
    };

    const referencia = await medir(pathToFileURL(APROVADA).href);
    const servida = await medir(`${URLS.landing}/`);
    await contexto.close();

    // sem esta trava, uma medicao vazia passaria como "igual"
    expect(referencia.length, 'a pagina aprovada nao foi medida').toBeGreaterThan(30);
    expect(servida.length, 'a pagina servida tem outra quantidade de blocos').toBe(referencia.length);

    const divergentes: string[] = [];
    referencia.forEach((ref, i) => {
      const novo = servida[i];
      if (ref.cls !== novo.cls) divergentes.push(`bloco ${i}: classe "${ref.cls}" virou "${novo.cls}"`);
      else if (Math.abs(ref.top - novo.top) > TOLERANCIA)
        divergentes.push(`bloco ${i} (${ref.cls}): posicao ${ref.top} virou ${novo.top}`);
      else if (Math.abs(ref.h - novo.h) > TOLERANCIA)
        divergentes.push(`bloco ${i} (${ref.cls}): altura ${ref.h} virou ${novo.h}`);
    });

    expect(divergentes, `divergencias:\n${divergentes.slice(0, 8).join('\n')}`).toHaveLength(0);
  });
}
