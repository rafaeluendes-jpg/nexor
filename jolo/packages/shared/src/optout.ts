/**
 * LGPD: reconhece quando a pessoa pede para nao receber mais mensagens.
 *
 * Conservador de proposito. "Parar" sozinho e pedido de parada; "quero
 * parar de trabalhar para abrir uma franquia" nao e. Na duvida, NAO trata
 * como pedido: quem decide e uma pessoa lendo a conversa, e o robo ja
 * sabe passar para ela.
 */
const PALAVRAS_SOZINHAS = new Set([
  'parar',
  'pare',
  'para',
  'stop',
  'sair',
  'cancelar',
  'descadastrar',
  'remover',
]);

const FRASES = [
  'nao quero mais',
  'nao quero receber',
  'para de mandar',
  'pare de mandar',
  'parem de mandar',
  'nao me mande',
  'nao mande mais',
  'remover meu numero',
  'remove meu numero',
  'tirar meu numero',
  'me tire da lista',
  'me tira da lista',
  'descadastrar',
];

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ehPedidoParaParar(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const t = normalizar(texto);
  if (!t) return false;
  if (PALAVRAS_SOZINHAS.has(t)) return true;
  // mensagem curta que e so o pedido, com "por favor" ou "obrigado" junto
  const semCortesia = t.replace(/\b(por favor|pfv|pf|obrigad[oa]|ok)\b/g, '').replace(/\s+/g, ' ').trim();
  if (PALAVRAS_SOZINHAS.has(semCortesia)) return true;
  return FRASES.some((f) => t.includes(f));
}

/** Resposta unica de confirmacao. Depois dela, o robo nao fala mais. */
export const CONFIRMACAO_DE_PARADA =
  'Tudo certo, não vamos mais enviar mensagens para este número. Se quiser voltar a conversar sobre a franquia, é só escrever aqui.';
