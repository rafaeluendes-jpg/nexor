import { describe, expect, it } from 'vitest';
import { dentroDoHorario, escolherResponsavel, type HorarioAtendimento, type Roteamento } from '@jolo/crm-core';

const COMERCIAL: HorarioAtendimento = {
  diasDaSemana: [1, 2, 3, 4, 5],
  horaInicio: '09:00',
  horaFim: '18:00',
  fusoHorario: 'America/Sao_Paulo',
};

/** Data em horario de Brasilia (UTC-3), escrita como UTC. */
function emBrasilia(iso: string): Date {
  return new Date(`${iso}-03:00`);
}

describe('horario de atendimento', () => {
  it('reconhece o meio da tarde de uma quarta como horario util', () => {
    expect(dentroDoHorario(COMERCIAL, emBrasilia('2026-09-09T14:00:00'))).toBe(true);
  });

  it('sabe que sabado nao tem ninguem', () => {
    expect(dentroDoHorario(COMERCIAL, emBrasilia('2026-09-12T14:00:00'))).toBe(false);
  });

  it('sabe que as 22h de um dia util tambem nao tem ninguem', () => {
    expect(dentroDoHorario(COMERCIAL, emBrasilia('2026-09-09T22:00:00'))).toBe(false);
  });

  it('respeita o fuso configurado, e nao o do servidor', () => {
    // meia-noite em Brasilia e 03:00 UTC: quem olhasse o relogio do servidor erraria o dia
    expect(dentroDoHorario(COMERCIAL, new Date('2026-09-10T03:00:00Z'))).toBe(false);
    expect(dentroDoHorario(COMERCIAL, new Date('2026-09-09T17:00:00Z'))).toBe(true);
  });

  it('loja que atende no sabado passa a atender no sabado', () => {
    const comSabado = { ...COMERCIAL, diasDaSemana: [1, 2, 3, 4, 5, 6] };
    expect(dentroDoHorario(comSabado, emBrasilia('2026-09-12T14:00:00'))).toBe(true);
  });
});

const BASE: Roteamento = { modo: 'RESPONSAVEL_FIXO', responsavelPadraoId: 'ana', rodizio: [], porChave: {} };

describe('quem atende o lead novo', () => {
  it('responsavel fixo manda sempre para a mesma pessoa', () => {
    expect(escolherResponsavel(BASE, { sequencia: 0 })).toBe('ana');
    expect(escolherResponsavel(BASE, { sequencia: 99 })).toBe('ana');
  });

  it('rodizio distribui na ordem e volta ao inicio', () => {
    const r: Roteamento = { ...BASE, modo: 'RODIZIO', rodizio: ['ana', 'bruno', 'carla'] };
    expect([0, 1, 2, 3, 4].map((s) => escolherResponsavel(r, { sequencia: s }))).toEqual([
      'ana', 'bruno', 'carla', 'ana', 'bruno',
    ]);
  });

  it('rodizio sem ninguem na fila cai no responsavel padrao', () => {
    expect(escolherResponsavel({ ...BASE, modo: 'RODIZIO' }, { sequencia: 3 })).toBe('ana');
  });

  it('por cidade encontra sem se importar com maiuscula ou espaco', () => {
    const r: Roteamento = { ...BASE, modo: 'POR_CIDADE', porChave: { Campinas: 'bruno' } };
    expect(escolherResponsavel(r, { cidade: ' campinas ', sequencia: 0 })).toBe('bruno');
  });

  it('cidade sem regra cai no responsavel padrao', () => {
    const r: Roteamento = { ...BASE, modo: 'POR_CIDADE', porChave: { Campinas: 'bruno' } };
    expect(escolherResponsavel(r, { cidade: 'Jales', sequencia: 0 })).toBe('ana');
  });

  it('por campanha manda o lead de cada anuncio para quem cuida dele', () => {
    const r: Roteamento = { ...BASE, modo: 'POR_CAMPANHA', porChave: { 'franquias-setembro': 'carla' } };
    expect(escolherResponsavel(r, { campanha: 'franquias-setembro', sequencia: 0 })).toBe('carla');
  });

  it('modo manual nao escolhe ninguem: o lead fica na fila geral', () => {
    expect(escolherResponsavel({ ...BASE, modo: 'MANUAL' }, { sequencia: 0 })).toBeNull();
  });
});
