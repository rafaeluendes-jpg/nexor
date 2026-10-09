/**
 * QR Code da vitrine de cada loja (jolo/scripts/gerar-qrcodes-lojas.py).
 * O QR leva utm_source=loja e utm_campaign=qrcode-<cidade>; aqui a marca
 * vira o nome que aparece no CRM. A lista precisa bater com a do gerador:
 * um QR impresso com uma marca que nao esta aqui aparece com a marca crua.
 */
export const LOJAS_QRCODE: Record<string, string> = {
  'qrcode-santa-fe-do-sul': 'Santa Fé do Sul',
  'qrcode-jales': 'Jales',
  'qrcode-sorocaba': 'Sorocaba',
  'qrcode-petropolis': 'Petrópolis',
  'qrcode-sao-paulo': 'São Paulo',
};

/** Cidade da loja cujo QR Code trouxe o lead, ou null se nao veio de QR de loja. */
export function lojaDoQrCode(campanha: string | null | undefined): string | null {
  if (!campanha) return null;
  return LOJAS_QRCODE[campanha.trim().toLowerCase()] ?? null;
}

/**
 * Nome da origem para a tela: "loja" + "qrcode-jales" vira
 * "QR Code da loja de Jales". A chave gravada no banco nao muda.
 */
export function nomeDaOrigem(origem: string | null | undefined, campanha?: string | null): string {
  if (!origem) return 'direto';
  if (origem.toLowerCase() !== 'loja') return origem;
  const loja = lojaDoQrCode(campanha);
  return loja ? `QR Code da loja de ${loja}` : 'QR Code da loja';
}

/** Nome da campanha para a tela: "qrcode-jales" vira "QR Code Jales". */
export function nomeDaCampanha(campanha: string | null | undefined): string | null {
  if (!campanha) return null;
  const loja = lojaDoQrCode(campanha);
  return loja ? `QR Code ${loja}` : campanha;
}
