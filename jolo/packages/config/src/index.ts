/**
 * Entrada PUBLICA do pacote: so o que pode viajar para o navegador.
 *
 * O contrato de ambiente do servidor (com nomes e valores padrao de
 * segredo) vive em "@jolo/config/server" e NUNCA e importado por app
 * de front-end. Ver tests/e2e/seguranca.spec.ts.
 */
export * from './site';
