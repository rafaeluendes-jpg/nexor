import { normalizePhoneBR } from '@jolo/shared';

/**
 * Leitura de uma planilha de leads antigos (item novo, pedido do Rafael).
 *
 * A planilha vem do jeito que a vida deu: coluna com nome diferente, telefone
 * com mascara, linha em branco no meio, a mesma pessoa duas vezes. Aqui a
 * gente entende o arquivo e diz, linha por linha, o que vai acontecer —
 * ANTES de gravar qualquer coisa.
 */

export type SituacaoDaLinha = 'novo' | 'repetido_no_arquivo' | 'ja_existe' | 'sem_telefone' | 'telefone_invalido';

export interface LinhaLida {
  linha: number;
  nome: string | null;
  telefoneOriginal: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  observacao: string | null;
  situacao: SituacaoDaLinha;
}

export interface LeituraDaPlanilha {
  colunasEncontradas: Record<string, string | null>;
  linhas: LinhaLida[];
  resumo: Record<SituacaoDaLinha, number>;
}

/** Nomes de coluna que a gente reconhece, sem acento e em minuscula. */
const APELIDOS: Record<string, string[]> = {
  nome: ['nome', 'nome completo', 'cliente', 'contato', 'lead', 'interessado', 'candidato', 'name'],
  telefone: ['telefone', 'celular', 'whatsapp', 'whats', 'fone', 'tel', 'numero', 'phone'],
  cidade: ['cidade', 'municipio', 'city', 'cidade de interesse', 'cidade interesse'],
  estado: ['estado', 'uf', 'state'],
  email: ['email', 'e-mail', 'mail'],
  observacao: ['observacao', 'observacoes', 'obs', 'anotacao', 'comentario', 'notas', 'historico'],
};

/** Tira acento, espaco sobrando e caixa alta para comparar cabecalho. */
export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Descobre qual coluna do arquivo corresponde a cada campo que precisamos. */
export function acharColunas(cabecalho: string[]): Record<string, number | null> {
  const limpo = cabecalho.map(normalizarCabecalho);
  const achadas: Record<string, number | null> = {};

  for (const [campo, apelidos] of Object.entries(APELIDOS)) {
    let indice = limpo.findIndex((c) => apelidos.includes(c));
    // nao achou igual: aceita cabecalho que CONTEM o apelido ("telefone 1", "nome do lead")
    if (indice < 0) indice = limpo.findIndex((c) => apelidos.some((a) => c.includes(a)));
    achadas[campo] = indice >= 0 ? indice : null;
  }
  return achadas;
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s.length ? s : null;
}

/**
 * Le as linhas e classifica cada uma. Nada e gravado aqui.
 * `jaNoBanco` traz os telefones que o sistema ja conhece.
 */
export function lerPlanilha(
  cabecalho: string[],
  linhas: unknown[][],
  jaNoBanco: Set<string>,
): LeituraDaPlanilha {
  const colunas = acharColunas(cabecalho);
  const vistosNoArquivo = new Set<string>();
  const lidas: LinhaLida[] = [];

  linhas.forEach((linha, i) => {
    const pega = (campo: string): string | null => {
      const idx = colunas[campo];
      return idx === null || idx === undefined ? null : texto(linha[idx]);
    };

    const nome = pega('nome');
    const telefoneOriginal = pega('telefone');
    // linha completamente vazia nao vira nada, nem erro
    if (!nome && !telefoneOriginal && !pega('email')) return;

    const telefone = telefoneOriginal ? normalizePhoneBR(telefoneOriginal) : null;

    let situacao: SituacaoDaLinha;
    if (!telefoneOriginal) situacao = 'sem_telefone';
    else if (!telefone) situacao = 'telefone_invalido';
    else if (vistosNoArquivo.has(telefone)) situacao = 'repetido_no_arquivo';
    else if (jaNoBanco.has(telefone)) situacao = 'ja_existe';
    else situacao = 'novo';

    if (telefone) vistosNoArquivo.add(telefone);

    lidas.push({
      linha: i + 2, // +2: a linha 1 e o cabecalho e a planilha conta a partir de 1
      nome,
      telefoneOriginal,
      telefone,
      cidade: pega('cidade'),
      estado: pega('estado')?.toUpperCase().slice(0, 2) ?? null,
      email: pega('email'),
      observacao: pega('observacao'),
      situacao,
    });
  });

  const resumo: Record<SituacaoDaLinha, number> = {
    novo: 0,
    repetido_no_arquivo: 0,
    ja_existe: 0,
    sem_telefone: 0,
    telefone_invalido: 0,
  };
  for (const l of lidas) resumo[l.situacao] += 1;

  const colunasEncontradas: Record<string, string | null> = {};
  for (const [campo, idx] of Object.entries(colunas)) {
    colunasEncontradas[campo] = idx === null || idx === undefined ? null : (cabecalho[idx] ?? null);
  }

  return { colunasEncontradas, linhas: lidas, resumo };
}

/** Le um CSV simples, respeitando aspas e aceitando virgula ou ponto e virgula. */
export function lerCsv(conteudo: string): { cabecalho: string[]; linhas: string[][] } {
  const texto = conteudo.replace(/^﻿/, '');
  const primeira = texto.split(/\r?\n/, 1)[0] ?? '';
  // planilha brasileira costuma sair com ponto e virgula
  const separador = (primeira.match(/;/g) ?? []).length > (primeira.match(/,/g) ?? []).length ? ';' : ',';

  const linhas: string[][] = [];
  let campo = '';
  let atual: string[] = [];
  let dentroDeAspas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (c === '"') {
        dentroDeAspas = false;
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') dentroDeAspas = true;
    else if (c === separador) {
      atual.push(campo);
      campo = '';
    } else if (c === '\n') {
      atual.push(campo);
      linhas.push(atual);
      atual = [];
      campo = '';
    } else if (c !== '\r') {
      campo += c;
    }
  }
  if (campo.length || atual.length) {
    atual.push(campo);
    linhas.push(atual);
  }

  const semVazias = linhas.filter((l) => l.some((c) => c.trim().length));
  return { cabecalho: (semVazias.shift() ?? []).map((c) => c.trim()), linhas: semVazias };
}
