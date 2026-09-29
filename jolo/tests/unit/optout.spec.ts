import { describe, expect, it } from 'vitest';
import { ehPedidoParaParar } from '@jolo/shared';

describe('pedido para parar (LGPD)', () => {
  it('reconhece o pedido, em qualquer caixa e com acento', () => {
    for (const t of ['PARAR', 'parar', 'Pare', 'SAIR', 'stop', 'Cancelar', 'parar, por favor', 'Parar obrigado', ' parar! ']) {
      expect(ehPedidoParaParar(t), t).toBe(true);
    }
    for (const t of ['Não quero mais receber mensagens', 'por favor para de mandar mensagem', 'Remover meu número da lista', 'me tira da lista']) {
      expect(ehPedidoParaParar(t), t).toBe(true);
    }
  });

  it('nao confunde conversa normal com pedido de parada', () => {
    for (const t of [
      'Quero parar de trabalhar para os outros e abrir minha franquia',
      'Para quando seria a reunião?',
      'Posso sair mais cedo do trabalho na quinta',
      'Qual o prazo para cancelar o contrato?',
      'oi',
      '',
    ]) {
      expect(ehPedidoParaParar(t), t).toBe(false);
    }
  });
});
