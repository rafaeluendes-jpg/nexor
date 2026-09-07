import { describe, expect, it } from 'vitest';
import { acharColunas, lerCsv, lerPlanilha, normalizarCabecalho } from '@jolo/crm-core';

describe('leitura do cabecalho da planilha', () => {
  it('reconhece a coluna de telefone com os nomes que a vida usa', () => {
    for (const nome of ['Telefone', 'CELULAR', 'WhatsApp', 'Fone', 'telefone 1', 'Celular do lead']) {
      const colunas = acharColunas(['Nome', nome, 'Cidade']);
      expect(colunas.telefone, `coluna "${nome}"`).toBe(1);
    }
  });

  it('reconhece nome, cidade, estado, e-mail e observacao', () => {
    const colunas = acharColunas(['Nome do lead', 'Celular', 'Cidade de interesse', 'UF', 'E-mail', 'Observações']);
    expect(colunas).toMatchObject({ nome: 0, telefone: 1, cidade: 2, estado: 3, email: 4, observacao: 5 });
  });

  it('avisa quando nao ha coluna de telefone', () => {
    expect(acharColunas(['Nome', 'Cidade']).telefone).toBeNull();
  });

  it('ignora acento e caixa no cabecalho', () => {
    expect(normalizarCabecalho('  OBSERVAÇÕES  ')).toBe('observacoes');
  });
});

describe('classificacao das linhas', () => {
  const cabecalho = ['Nome', 'Celular', 'Cidade', 'UF'];

  it('separa novo, repetido, ja existente e telefone invalido', () => {
    const jaNoBanco = new Set(['5519998812340']);
    const leitura = lerPlanilha(
      cabecalho,
      [
        ['Carlos', '(17) 99812-3344', 'Jales', 'SP'],
        ['Ana', '17 99823-4455', 'Fernandopolis', 'SP'],
        ['Roberto', '17998234455', 'Fernandopolis', 'SP'],
        ['Sem telefone', '', 'Jales', 'SP'],
        ['Quebrado', '123', 'Jales', 'SP'],
        ['Ja e nosso', '(19) 99881-2340', 'Campinas', 'SP'],
      ],
      jaNoBanco,
    );

    expect(leitura.linhas.map((l) => l.situacao)).toEqual([
      'novo', 'novo', 'repetido_no_arquivo', 'sem_telefone', 'telefone_invalido', 'ja_existe',
    ]);
    expect(leitura.resumo.novo).toBe(2);
  });

  it('pula linha completamente vazia sem virar erro', () => {
    const leitura = lerPlanilha(cabecalho, [['Carlos', '17998123344', '', ''], ['', '', '', '']], new Set());
    expect(leitura.linhas).toHaveLength(1);
  });

  it('numera a linha como a planilha numera, contando o cabecalho', () => {
    const leitura = lerPlanilha(cabecalho, [['Carlos', '17998123344', '', '']], new Set());
    expect(leitura.linhas[0]?.linha, 'primeira linha de dados e a 2 na planilha').toBe(2);
  });

  it('reconhece o mesmo telefone escrito de jeitos diferentes', () => {
    const leitura = lerPlanilha(
      cabecalho,
      [['A', '(17) 99812-3344', '', ''], ['B', '+55 17 99812 3344', '', ''], ['C', '017998123344', '', '']],
      new Set(),
    );
    expect(leitura.linhas.map((l) => l.situacao)).toEqual(['novo', 'repetido_no_arquivo', 'repetido_no_arquivo']);
  });

  it('guarda a observacao da planilha para virar anotacao no lead', () => {
    const leitura = lerPlanilha(
      ['Nome', 'Telefone', 'Obs'],
      [['Carlos', '17998123344', 'Ligou em 2023']],
      new Set(),
    );
    expect(leitura.linhas[0]?.observacao).toBe('Ligou em 2023');
  });
});

describe('leitura de CSV', () => {
  it('entende planilha brasileira, com ponto e virgula', () => {
    const { cabecalho, linhas } = lerCsv('Nome;Telefone\nCarlos;17998123344\n');
    expect(cabecalho).toEqual(['Nome', 'Telefone']);
    expect(linhas).toEqual([['Carlos', '17998123344']]);
  });

  it('entende virgula quando e o separador do arquivo', () => {
    const { cabecalho } = lerCsv('Nome,Telefone,Cidade\nCarlos,17998123344,Jales\n');
    expect(cabecalho).toEqual(['Nome', 'Telefone', 'Cidade']);
  });

  it('respeita campo entre aspas com o separador dentro', () => {
    const { linhas } = lerCsv('Nome;Obs\nCarlos;"Ligou, pediu retorno"\n');
    expect(linhas[0]?.[1]).toBe('Ligou, pediu retorno');
  });

  it('descarta a marca invisivel que o Excel poe no comeco do arquivo', () => {
    const { cabecalho } = lerCsv('﻿Nome;Telefone\nCarlos;17998123344\n');
    expect(cabecalho[0]).toBe('Nome');
  });

  it('nao cria linha a partir de linha em branco', () => {
    const { linhas } = lerCsv('Nome;Telefone\nCarlos;17998123344\n\n\n');
    expect(linhas).toHaveLength(1);
  });
});
