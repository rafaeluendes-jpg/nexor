/**
 * Termo de uso e confidencialidade do CRM (LGPD, art. 46 e 47: quem trata
 * dado pessoal em nome da empresa responde pelo sigilo). Todo usuário
 * aceita a versão vigente antes de ver qualquer dado.
 *
 * Mudou o texto? Troque a VERSÃO: todos precisam aceitar de novo. Texto
 * novo com a versão velha seria aceite de algo que a pessoa não leu.
 */
export const TERMO_DE_USO = {
  versao: '2026-09-29',
  titulo: 'Termo de uso e confidencialidade',
  paragrafos: [
    'Este sistema guarda dados pessoais de candidatos a franqueado: nome, telefone, cidade, capital disponível, mensagens trocadas e documentos. Esses dados são protegidos pela Lei Geral de Proteção de Dados (Lei 13.709/2018).',
    'Eu me comprometo a usar esses dados somente para atender os candidatos e conduzir o processo de franquia da Jolô Gelato, e para nenhuma outra finalidade.',
    'Não vou copiar, fotografar, exportar, encaminhar ou compartilhar dados do sistema fora dele, exceto quando fizer parte do meu trabalho e com autorização da Jolô Gelato.',
    'Meu acesso é pessoal e intransferível. Não vou emprestar minha senha nem deixar o sistema aberto sem supervisão. Se desconfiar que alguém usou meu acesso, aviso imediatamente.',
    'Sei que tudo o que faço no sistema fica registrado — quem acessou, quando e o que alterou — e que esse registro pode ser consultado.',
    'Se um candidato pedir para ver, corrigir ou apagar os próprios dados, encaminho o pedido para a administração da Jolô Gelato, que responde dentro do prazo da lei.',
    'O descumprimento deste termo pode levar à suspensão do acesso e às medidas previstas em contrato e em lei. Esta obrigação de sigilo continua valendo mesmo depois que meu acesso terminar.',
  ],
} as const;

export type TermoDeUso = typeof TERMO_DE_USO;
