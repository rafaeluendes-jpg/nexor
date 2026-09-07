import { describe, expect, it } from 'vitest';
import { computeScore, parseCapitalRange, temperatureFor } from '@jolo/crm-core';

describe('score do lead', () => {
  it('lead completo e compativel fica quente', () => {
    const r = computeScore({
      capitalAvailable: 400_000,
      investmentHorizon: '60 dias',
      desiredCity: 'Ribeirao Preto',
      businessExperience: 'tenho duas lojas de roupa',
      availability: 'integral',
      inboundMessages: 6,
    });
    expect(r.total).toBe(100);
    expect(r.temperature).toBe('QUENTE');
  });

  it('lead sem informacao fica frio', () => {
    expect(computeScore({}).total).toBe(0);
    expect(computeScore({}).temperature).toBe('FRIO');
  });

  it('capital abaixo do investimento nao pontua', () => {
    const r = computeScore({ capitalAvailable: 50_000, desiredCity: 'Bauru' });
    expect(r.breakdown.capital_compativel).toBeUndefined();
    expect(r.breakdown.cidade_disponivel).toBe(20);
  });

  it('cidade ja ocupada nao pontua', () => {
    const r = computeScore({ desiredCity: 'Sorocaba', cityAvailable: false });
    expect(r.breakdown.cidade_disponivel).toBeUndefined();
  });

  it('le faixas escritas em texto livre', () => {
    expect(parseCapitalRange('ate 200 mil')).toBe(200_000);
    expect(parseCapitalRange('R$ 350.000')).toBe(350_000);
    expect(parseCapitalRange('1 milhao')).toBe(1_000_000);
    expect(parseCapitalRange('sem ideia')).toBeNull();
  });

  it('classifica a temperatura pelas faixas', () => {
    expect(temperatureFor(70)).toBe('QUENTE');
    expect(temperatureFor(40)).toBe('MORNO');
    expect(temperatureFor(39)).toBe('FRIO');
  });
});
