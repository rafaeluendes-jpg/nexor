/** Formatacao para leitura humana. Um lugar so, para tudo aparecer igual. */

export function data(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function dataHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "ha 5 minutos", "ontem". Melhor que data crua numa lista de conversas. */
export function quandoFoi(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  const minutos = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `ha ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `ha ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ontem';
  if (dias < 30) return `ha ${dias} dias`;
  return data(d);
}

export function numero(valor: number | null | undefined, casas = 0): string {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function porcentagem(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function dinheiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Rotulo legivel para o que o banco guarda em CAIXA_ALTA. */
export function rotulo(valor: string | null | undefined): string {
  if (!valor) return '—';
  const texto = valor.replace(/_/g, ' ').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Sinal de entrega da mensagem, como o WhatsApp mostra (item 12). */
export function sinalDeEntrega(status: string): { simbolo: string; texto: string } {
  switch (status) {
    case 'QUEUED':
      return { simbolo: '🕗', texto: 'na fila' };
    case 'SENT':
      return { simbolo: '✓', texto: 'enviada' };
    case 'DELIVERED':
      return { simbolo: '✓✓', texto: 'entregue' };
    case 'READ':
      return { simbolo: '✓✓', texto: 'lida' };
    case 'FAILED':
      return { simbolo: '⚠', texto: 'erro no envio' };
    default:
      return { simbolo: '', texto: status };
  }
}
