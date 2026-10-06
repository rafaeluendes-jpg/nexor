-- FOTOGRAFIA DA PRODUÇÃO, 06/10/2026 — gatilhos, RLS ligada e políticas de acesso, como estão no ar.
CREATE TRIGGER aa_fabrica_nao_sobrescreve BEFORE UPDATE ON public.contas_capital FOR EACH ROW EXECUTE FUNCTION tg_conta_fabrica_nao_sobrescreve();
CREATE TRIGGER aa_fabrica_nao_sobrescreve BEFORE UPDATE ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION tg_forma_fabrica_nao_sobrescreve();
CREATE TRIGGER ab_brinde_nulo_nao_apaga BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION tg_brinde_nulo_nao_apaga();
CREATE TRIGGER ab_enderecos_nulo_nao_apaga BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION tg_enderecos_nulo_nao_apaga();
CREATE TRIGGER ab_fechamento_nao_se_apaga BEFORE UPDATE ON public.caixas FOR EACH ROW EXECUTE FUNCTION tg_fechamento_nao_se_apaga();
CREATE TRIGGER ab_saldo_mais_novo_vence BEFORE UPDATE ON public.estoque_unidade FOR EACH ROW EXECUTE FUNCTION tg_saldo_mais_novo_vence();
CREATE TRIGGER ab_sucursais_vista BEFORE UPDATE ON public.ficha_grupos FOR EACH ROW EXECUTE FUNCTION tg_sucursais_vista();
CREATE TRIGGER ab_sucursais_vista BEFORE UPDATE ON public.fichas_tecnicas FOR EACH ROW EXECUTE FUNCTION tg_sucursais_vista();
CREATE TRIGGER ab_tempo_digitado_e_lei BEFORE UPDATE ON public.cardapio_config FOR EACH ROW EXECUTE FUNCTION tg_tempo_digitado_e_lei();
CREATE TRIGGER ab_versao_vista BEFORE UPDATE ON public.baixas_pendentes FOR EACH ROW EXECUTE FUNCTION tg_versao_vista();
CREATE TRIGGER ab_versao_vista BEFORE UPDATE ON public.contas_capital FOR EACH ROW EXECUTE FUNCTION tg_versao_vista();
CREATE TRIGGER ab_versao_vista BEFORE UPDATE ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION tg_versao_vista();
CREATE TRIGGER ab_versao_vista BEFORE UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION tg_versao_vista();
CREATE TRIGGER tg_audit_imutavel BEFORE DELETE OR UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION tg_audit_imutavel();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.baixas_pendentes FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.bases_catalogo FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.caixa_movimentos FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.caixas FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.cancelamentos FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.clientes_nexor FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.config_loja FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.contagens_estoque FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.contas_capital FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.cupons FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.estoque_unidade FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.fiado_movimentos FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.ficha_grupos FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.ficha_itens FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.fichas_tecnicas FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.indicadores_manuais FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.lojas FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.lotes_estoque FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.lotes_financeiros FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.motivos_cancelamento FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.notas_entrada FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.ordens_producao FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.pedido_base_itens FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.pedidos_base FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.perfis FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.sucursais FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.transferencias FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_auditar AFTER INSERT OR DELETE OR UPDATE ON public.usuarios_sistema FOR EACH ROW EXECUTE FUNCTION tg_auditar();
CREATE TRIGGER tg_caixa_fechado_trava_movimento BEFORE INSERT OR DELETE OR UPDATE ON public.caixa_movimentos FOR EACH ROW EXECUTE FUNCTION tg_caixa_fechado_trava_movimento();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.acertos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.areas_entrega FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.baixas_pendentes FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.bases_catalogo FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.caixas FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.cancelamentos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.cardapio_config FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.clientes_nexor FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.compras_sem_vinculo FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.config_loja FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.config_operacao FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.contagens_estoque FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.contas_capital FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.cupom_usos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.cupons FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.cupons_fiscais FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.entregadores FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.estoque_unidade FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.fiado_movimentos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.ficha_grupos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.fichas_tecnicas FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.grupos_ingredientes FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.grupos_opcoes FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.indicadores_manuais FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.loja_versao FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.lotes_estoque FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.lotes_financeiros FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.mesa_comandas FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.mesas FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.modelos_impressao FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.motivos_cancelamento FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.motivos_movimentacao FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.notas_entrada FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.ordens_producao FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.pedidos_base FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.status_venda FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.sucursais FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.transferencias FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.unidades_medida FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_forcar_loja BEFORE INSERT OR UPDATE ON public.usuarios_sistema FOR EACH ROW EXECUTE FUNCTION forcar_minha_loja();
CREATE TRIGGER tg_limitar_gerente_unidade BEFORE INSERT OR UPDATE ON public.usuarios_sistema FOR EACH ROW EXECUTE FUNCTION tg_limitar_gerente_unidade();
CREATE TRIGGER tg_pagamento_nao_duplica BEFORE INSERT ON public.pedido_pagamentos FOR EACH ROW EXECUTE FUNCTION tg_pagamento_nao_duplica();
CREATE TRIGGER tg_pagamento_repetido BEFORE INSERT ON public.pedido_pagamentos FOR EACH ROW EXECUTE FUNCTION trava_pagamento_repetido();
CREATE TRIGGER tg_pagamento_sem_valor BEFORE INSERT ON public.pedido_pagamentos FOR EACH ROW EXECUTE FUNCTION tg_pagamento_sem_valor();
CREATE TRIGGER tg_resolve_forma BEFORE INSERT OR UPDATE ON public.pedido_pagamentos FOR EACH ROW EXECUTE FUNCTION resolve_forma_pagamento();
CREATE TRIGGER tg_senha_nunca_em_claro BEFORE INSERT OR UPDATE ON public.usuarios_sistema FOR EACH ROW EXECUTE FUNCTION tg_senha_nunca_em_claro();
CREATE TRIGGER tg_trava_horario BEFORE UPDATE ON public.cardapio_config FOR EACH ROW EXECUTE FUNCTION trava_horario_padrao();
CREATE TRIGGER trg_cancelamento_estorna AFTER INSERT ON public.cancelamentos FOR EACH ROW EXECUTE FUNCTION tg_cancelamento_estorna();
CREATE TRIGGER trg_pedido_preenche_sucursal BEFORE INSERT OR UPDATE OF caixa_id, sucursal_id ON public.pedidos FOR EACH ROW EXECUTE FUNCTION tg_pedido_preenche_sucursal();
CREATE TRIGGER trg_versao_acertos AFTER INSERT OR DELETE OR UPDATE ON public.acertos FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_areas_entrega AFTER INSERT OR DELETE OR UPDATE ON public.areas_entrega FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_caixas AFTER INSERT OR DELETE OR UPDATE ON public.caixas FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_cardapio_config AFTER INSERT OR DELETE OR UPDATE ON public.cardapio_config FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_categorias AFTER INSERT OR DELETE OR UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_categorias_financeiras AFTER INSERT OR DELETE OR UPDATE ON public.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_clientes AFTER INSERT OR DELETE OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_clientes_nexor AFTER INSERT OR DELETE OR UPDATE ON public.clientes_nexor FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_compras_sem_vinculo AFTER INSERT OR DELETE OR UPDATE ON public.compras_sem_vinculo FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_config_loja AFTER INSERT OR DELETE OR UPDATE ON public.config_loja FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_contagens_estoque AFTER INSERT OR DELETE OR UPDATE ON public.contagens_estoque FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_contas_capital AFTER INSERT OR DELETE OR UPDATE ON public.contas_capital FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_cupom_usos AFTER INSERT OR DELETE OR UPDATE ON public.cupom_usos FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_cupons AFTER INSERT OR DELETE OR UPDATE ON public.cupons FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_entregadores AFTER INSERT OR DELETE OR UPDATE ON public.entregadores FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_fiado_movimentos AFTER INSERT OR DELETE OR UPDATE ON public.fiado_movimentos FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_ficha_grupos AFTER INSERT OR DELETE OR UPDATE ON public.ficha_grupos FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_fichas_tecnicas AFTER INSERT OR DELETE OR UPDATE ON public.fichas_tecnicas FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_formas_pagamento AFTER INSERT OR DELETE OR UPDATE ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_fornecedores AFTER INSERT OR DELETE OR UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_grupos_ingredientes AFTER INSERT OR DELETE OR UPDATE ON public.grupos_ingredientes FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_grupos_opcoes AFTER INSERT OR DELETE OR UPDATE ON public.grupos_opcoes FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_insumos AFTER INSERT OR DELETE OR UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_lancamentos_financeiros AFTER INSERT OR DELETE OR UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_lotes_financeiros AFTER INSERT OR DELETE OR UPDATE ON public.lotes_financeiros FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_motivos_movimentacao AFTER INSERT OR DELETE OR UPDATE ON public.motivos_movimentacao FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_movimentacoes_estoque AFTER INSERT OR DELETE OR UPDATE ON public.movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_notas_entrada AFTER INSERT OR DELETE OR UPDATE ON public.notas_entrada FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_ordens_producao AFTER INSERT OR DELETE OR UPDATE ON public.ordens_producao FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_pedidos AFTER INSERT OR DELETE OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_perfis AFTER INSERT OR DELETE OR UPDATE ON public.perfis FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_produtos AFTER INSERT OR DELETE OR UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_sucursais AFTER INSERT OR DELETE OR UPDATE ON public.sucursais FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_unidades_medida AFTER INSERT OR DELETE OR UPDATE ON public.unidades_medida FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER trg_versao_usuarios_sistema AFTER INSERT OR DELETE OR UPDATE ON public.usuarios_sistema FOR EACH ROW EXECUTE FUNCTION bump_loja_versao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.baixas_pendentes FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.caixa_movimentos FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.caixas FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.cancelamentos FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.categorias_financeiras FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.compras_sem_vinculo FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.contagens_estoque FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.contas_capital FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.estoque_unidade FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.ficha_itens FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.fichas_tecnicas FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.formas_pagamento FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.indicadores_manuais FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.lotes_estoque FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.lotes_financeiros FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.motivos_movimentacao FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.notas_entrada FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.ordens_producao FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.pedido_itens FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.pedido_pagamentos FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.subcategorias_financeiras FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.sucursais FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.transferencias FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.unidades_medida FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
CREATE TRIGGER zz_carimbar_alteracao BEFORE INSERT OR UPDATE ON public.usuarios_sistema FOR EACH ROW EXECUTE FUNCTION carimbar_alteracao();
alter table public.acertos enable row level security;
alter table public.areas_entrega enable row level security;
alter table public.areas_zonas enable row level security;
alter table public.audit_log enable row level security;
alter table public.baixas_pendentes enable row level security;
alter table public.bases_catalogo enable row level security;
alter table public.caixa_movimentos enable row level security;
alter table public.caixas enable row level security;
alter table public.cancelamentos enable row level security;
alter table public.cardapio_config enable row level security;
alter table public.categorias enable row level security;
alter table public.categorias_financeiras enable row level security;
alter table public.clientes enable row level security;
alter table public.clientes_nexor enable row level security;
alter table public.compras_sem_vinculo enable row level security;
alter table public.config_loja enable row level security;
alter table public.config_operacao enable row level security;
alter table public.contagens_estoque enable row level security;
alter table public.contas_capital enable row level security;
alter table public.cupom_usos enable row level security;
alter table public.cupons enable row level security;
alter table public.cupons_fiscais enable row level security;
alter table public.entregador_taxas enable row level security;
alter table public.entregadores enable row level security;
alter table public.estoque_unidade enable row level security;
alter table public.fiado_movimentos enable row level security;
alter table public.ficha_grupos enable row level security;
alter table public.ficha_itens enable row level security;
alter table public.fichas_tecnicas enable row level security;
alter table public.formas_pagamento enable row level security;
alter table public.fornecedores enable row level security;
alter table public.grupos_ingredientes enable row level security;
alter table public.grupos_opcoes enable row level security;
alter table public.indicadores_manuais enable row level security;
alter table public.insumos enable row level security;
alter table public.lancamentos_financeiros enable row level security;
alter table public.lojas enable row level security;
alter table public.lotes_estoque enable row level security;
alter table public.lotes_financeiros enable row level security;
alter table public.mesa_comandas enable row level security;
alter table public.mesas enable row level security;
alter table public.modelos_impressao enable row level security;
alter table public.motivos_cancelamento enable row level security;
alter table public.motivos_movimentacao enable row level security;
alter table public.movimentacoes_estoque enable row level security;
alter table public.notas_entrada enable row level security;
alter table public.opcoes enable row level security;
alter table public.ordens_producao enable row level security;
alter table public.pedido_base_itens enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.pedido_pagamentos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedidos_base enable row level security;
alter table public.perfis enable row level security;
alter table public.produto_grupos enable row level security;
alter table public.produtos enable row level security;
alter table public.status_venda enable row level security;
alter table public.subcategorias_financeiras enable row level security;
alter table public.sucursais enable row level security;
alter table public.transferencias enable row level security;
alter table public.turnos enable row level security;
alter table public.unidades_medida enable row level security;
alter table public.usuarios_sistema enable row level security;
create policy "acesso - areas_zonas" on public.areas_zonas as PERMISSIVE for ALL to public using ((area_id IN ( SELECT areas_entrega.id
   FROM areas_entrega))) with check ((area_id IN ( SELECT areas_entrega.id
   FROM areas_entrega)));
create policy "acesso caixa_movimentos" on public.caixa_movimentos as PERMISSIVE for ALL to public using ((caixa_id IN ( SELECT caixas.id
   FROM caixas))) with check ((caixa_id IN ( SELECT caixas.id
   FROM caixas)));
create policy "acesso categorias" on public.categorias as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso entregador_taxas" on public.entregador_taxas as PERMISSIVE for ALL to public using ((entregador_id IN ( SELECT entregadores.id
   FROM entregadores))) with check ((entregador_id IN ( SELECT entregadores.id
   FROM entregadores)));
create policy "acesso ficha itens" on public.ficha_itens as PERMISSIVE for ALL to public using ((ficha_id IN ( SELECT fichas_tecnicas.id
   FROM fichas_tecnicas
  WHERE ((fichas_tecnicas.loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (fichas_tecnicas.loja_id IN ( SELECT lojas.id
           FROM lojas
          WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))))) with check ((ficha_id IN ( SELECT fichas_tecnicas.id
   FROM fichas_tecnicas
  WHERE ((fichas_tecnicas.loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (fichas_tecnicas.loja_id IN ( SELECT lojas.id
           FROM lojas
          WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))))));
create policy "acesso fichas" on public.fichas_tecnicas as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso grupos_opcoes" on public.grupos_opcoes as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso insumos" on public.insumos as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso opcoes" on public.opcoes as PERMISSIVE for ALL to public using ((grupo_id IN ( SELECT grupos_opcoes.id
   FROM grupos_opcoes
  WHERE ((grupos_opcoes.loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (grupos_opcoes.loja_id IN ( SELECT lojas.id
           FROM lojas
          WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))))) with check ((grupo_id IN ( SELECT grupos_opcoes.id
   FROM grupos_opcoes
  WHERE ((grupos_opcoes.loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (grupos_opcoes.loja_id IN ( SELECT lojas.id
           FROM lojas
          WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))))));
create policy "acesso pedido_itens" on public.pedido_itens as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE (p.id = pedido_itens.pedido_id)))) with check ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE (p.id = pedido_itens.pedido_id))));
create policy "acesso pedido_pagamentos" on public.pedido_pagamentos as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE (p.id = pedido_pagamentos.pedido_id)))) with check ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE (p.id = pedido_pagamentos.pedido_id))));
create policy "acesso por loja - acertos" on public.acertos as PERMISSIVE for ALL to public using ((((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - areas_entrega" on public.areas_entrega as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - categorias_financeiras" on public.categorias_financeiras as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - clientes" on public.clientes as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - config_loja" on public.config_loja as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - config_operacao" on public.config_operacao as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - contagens_estoque" on public.contagens_estoque as PERMISSIVE for ALL to public using ((((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - cupom_usos" on public.cupom_usos as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - cupons" on public.cupons as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - cupons_fiscais" on public.cupons_fiscais as PERMISSIVE for ALL to public using ((((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - entregadores" on public.entregadores as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - estoque_unidade" on public.estoque_unidade as PERMISSIVE for ALL to public using ((((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - fiado_movimentos" on public.fiado_movimentos as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - ficha_grupos" on public.ficha_grupos as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - formas_pagamento" on public.formas_pagamento as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - fornecedores" on public.fornecedores as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - grupos_ingredientes" on public.grupos_ingredientes as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - indicadores_manuais" on public.indicadores_manuais as PERMISSIVE for ALL to public using ((((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - mesa_comandas" on public.mesa_comandas as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - mesas" on public.mesas as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - modelos_impressao" on public.modelos_impressao as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - motivos_cancelamento" on public.motivos_cancelamento as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - motivos_movimentacao" on public.motivos_movimentacao as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - ordens_producao" on public.ordens_producao as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - pedidos" on public.pedidos as PERMISSIVE for ALL to public using ((((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_uuid() AS minha_sucursal_uuid))))) with check ((((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_uuid() AS minha_sucursal_uuid)))));
create policy "acesso por loja - status_venda" on public.status_venda as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - transferencias" on public.transferencias as PERMISSIVE for ALL to public using ((((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)) OR (origem_suc = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)) OR (destino_suc = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - turnos" on public.turnos as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso por loja - unidades_medida" on public.unidades_medida as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso produto_grupos" on public.produto_grupos as PERMISSIVE for ALL to public using ((produto_id IN ( SELECT produtos.id
   FROM produtos
  WHERE ((produtos.loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (produtos.loja_id IN ( SELECT lojas.id
           FROM lojas
          WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))))) with check ((produto_id IN ( SELECT produtos.id
   FROM produtos
  WHERE ((produtos.loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (produtos.loja_id IN ( SELECT lojas.id
           FROM lojas
          WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))))));
create policy "acesso produtos" on public.produtos as PERMISSIVE for ALL to public using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "acesso subcategorias" on public.subcategorias_financeiras as PERMISSIVE for ALL to public using ((categoria_id IN ( SELECT categorias_financeiras.id
   FROM categorias_financeiras))) with check ((categoria_id IN ( SELECT categorias_financeiras.id
   FROM categorias_financeiras)));
create policy "baixas: altera quem tem a tela" on public.baixas_pendentes as PERMISSIVE for UPDATE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('controle/baixa-manual'::text) AS posso))) with check ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "baixas: apaga quem tem a tela" on public.baixas_pendentes as PERMISSIVE for DELETE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('controle/baixa-manual'::text) AS posso)));
create policy "baixas: grava quem tem a tela" on public.baixas_pendentes as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('controle/baixa-manual'::text) AS posso)));
create policy "baixas: leitura da rede" on public.baixas_pendentes as PERMISSIVE for SELECT to authenticated using ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "bases: rede le" on public.bases_catalogo as PERMISSIVE for SELECT to authenticated using ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "bases: so a matriz mantem" on public.bases_catalogo as PERMISSIVE for ALL to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('controle/bases-valores'::text) AS posso))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('controle/bases-valores'::text) AS posso)));
create policy "caixas: altera quem tem PDV" on public.caixas as PERMISSIVE for UPDATE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('pdv/pdv'::text) AS posso) OR ( SELECT posso('financeira/frente-caixa'::text) AS posso)))) with check ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "caixas: apaga so gestor" on public.caixas as PERMISSIVE for DELETE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT sou_gestor() AS sou_gestor)));
create policy "caixas: leitura da rede" on public.caixas as PERMISSIVE for SELECT to public using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "caixas: opera quem tem PDV" on public.caixas as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('pdv/pdv'::text) AS posso) OR ( SELECT posso('financeira/frente-caixa'::text) AS posso))));
create policy "cancelamentos: grava quem opera caixa" on public.cancelamentos as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('pdv/pdv'::text) AS posso) OR ( SELECT posso('financeira/frente-caixa'::text) AS posso))));
create policy "cancelamentos: leitura da rede" on public.cancelamentos as PERMISSIVE for SELECT to authenticated using ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "cancelamentos: reenvio de quem opera caixa" on public.cancelamentos as PERMISSIVE for UPDATE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('pdv/pdv'::text) AS posso) OR ( SELECT posso('financeira/frente-caixa'::text) AS posso)))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('pdv/pdv'::text) AS posso) OR ( SELECT posso('financeira/frente-caixa'::text) AS posso))));
create policy "cardapio dono" on public.cardapio_config as PERMISSIVE for ALL to public using ((loja_id = ( SELECT minha_loja() AS minha_loja))) with check ((loja_id = ( SELECT minha_loja() AS minha_loja)));
create policy "cardapio publico - areas" on public.areas_entrega as PERMISSIVE for SELECT to anon using ((loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[])));
create policy "cardapio publico - categorias" on public.categorias as PERMISSIVE for SELECT to anon using (((ativa IS NOT FALSE) AND (loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[]))));
create policy "cardapio publico - config" on public.cardapio_config as PERMISSIVE for SELECT to public using ((ativo = true));
create policy "cardapio publico - formas" on public.formas_pagamento as PERMISSIVE for SELECT to anon using ((loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[])));
create policy "cardapio publico - grupos" on public.grupos_opcoes as PERMISSIVE for SELECT to anon using ((loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[])));
create policy "cardapio publico - opcoes" on public.opcoes as PERMISSIVE for SELECT to anon using ((grupo_id IN ( SELECT g.id
   FROM grupos_opcoes g
  WHERE (g.loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[])))));
create policy "cardapio publico - produtos" on public.produtos as PERMISSIVE for SELECT to anon using (((ativo IS NOT FALSE) AND (loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[]))));
create policy "cardapio publico - unidades" on public.sucursais as PERMISSIVE for SELECT to anon using ((ativa AND (loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[]))));
create policy "cardapio publico - vinculo de grupos" on public.produto_grupos as PERMISSIVE for SELECT to anon using ((EXISTS ( SELECT 1
   FROM produtos p
  WHERE ((p.id = produto_grupos.produto_id) AND p.ativo AND (p.loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[]))))));
create policy "cardapio publico - zonas" on public.areas_zonas as PERMISSIVE for SELECT to anon using ((area_id IN ( SELECT a.id
   FROM areas_entrega a
  WHERE (a.loja_id = ANY (( SELECT lojas_com_cardapio() AS lojas_com_cardapio)::uuid[])))));
create policy "cliente le o proprio contrato" on public.clientes_nexor as PERMISSIVE for SELECT to authenticated using ((( SELECT sou_plataforma() AS sou_plataforma) OR (loja_id = ( SELECT minha_loja() AS minha_loja))));
create policy "contas: grava com permissao" on public.contas_capital as PERMISSIVE for ALL to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/contas-bancarias'::text) AS posso))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/contas-bancarias'::text) AS posso)));
create policy "contas: leitura da rede" on public.contas_capital as PERMISSIVE for SELECT to authenticated using ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "financeiro: altera com permissao" on public.lancamentos_financeiros as PERMISSIVE for UPDATE to public using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/lancamentos-financeiros'::text) AS posso) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/lancamentos-financeiros'::text) AS posso)));
create policy "financeiro: apaga quem tem o financeiro" on public.lancamentos_financeiros as PERMISSIVE for DELETE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/lancamentos-financeiros'::text) AS posso) AND (COALESCE(conciliado, false) = false) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "financeiro: apaga so gestor" on public.lancamentos_financeiros as PERMISSIVE for DELETE to public using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT sou_gestor() AS sou_gestor) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "financeiro: grava com permissao" on public.lancamentos_financeiros as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/lancamentos-financeiros'::text) AS posso)));
create policy "financeiro: leitura da rede" on public.lancamentos_financeiros as PERMISSIVE for SELECT to public using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "financeiro: o caixa grava a propria sangria" on public.lancamentos_financeiros as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (origem = 'mov-caixa'::text) AND (tipo = 'transferencia'::text) AND (pagamento >= '2026-10-01'::date) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "financeiro: o caixa reenvia a propria sangria" on public.lancamentos_financeiros as PERMISSIVE for UPDATE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (origem = 'mov-caixa'::text) AND (tipo = 'transferencia'::text) AND (pagamento >= '2026-10-01'::date) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (origem = 'mov-caixa'::text) AND (tipo = 'transferencia'::text) AND (pagamento >= '2026-10-01'::date) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "le a auditoria da minha empresa" on public.audit_log as PERMISSIVE for SELECT to authenticated using ((( SELECT sou_plataforma() AS sou_plataforma) OR (loja_id = ( SELECT minha_loja() AS minha_loja))));
create policy "logado - compras_sem_vinculo" on public.compras_sem_vinculo as PERMISSIVE for ALL to authenticated using (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa))))))) with check (((loja_id = ( SELECT minha_loja() AS minha_loja)) OR (( SELECT sou_admin() AS sou_admin) AND (loja_id IN ( SELECT lojas.id
   FROM lojas
  WHERE (lojas.empresa_id = ( SELECT minha_empresa() AS minha_empresa)))))));
create policy "lote financeiro: altera com permissao" on public.lotes_financeiros as PERMISSIVE for UPDATE to public using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/lancamentos-financeiros'::text) AS posso) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref))))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/lancamentos-financeiros'::text) AS posso)));
create policy "lote financeiro: grava com permissao" on public.lotes_financeiros as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('financeira/lancamentos-financeiros'::text) AS posso)));
create policy "lote financeiro: leitura da rede" on public.lotes_financeiros as PERMISSIVE for SELECT to public using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "lote: apaga so gestor" on public.lotes_estoque as PERMISSIVE for DELETE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT sou_gestor() AS sou_gestor)));
create policy "lote: atualiza com permissao" on public.lotes_estoque as PERMISSIVE for UPDATE to public using ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[])))) with check ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "lote: grava com permissao" on public.lotes_estoque as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('estoque/notas-entrada'::text) AS posso) OR ( SELECT posso('estoque/movimentacao-estoque'::text) AS posso))));
create policy "lote: leitura da rede" on public.lotes_estoque as PERMISSIVE for SELECT to public using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "movimentacao: apaga so gestor" on public.movimentacoes_estoque as PERMISSIVE for DELETE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT sou_gestor() AS sou_gestor)));
create policy "movimentacao: atualiza com permissao" on public.movimentacoes_estoque as PERMISSIVE for UPDATE to public using ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[])))) with check ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "movimentacao: grava com permissao" on public.movimentacoes_estoque as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('estoque/movimentacao-estoque'::text) AS posso) OR ( SELECT posso('pdv/pdv'::text) AS posso) OR ( SELECT posso('estoque/notas-entrada'::text) AS posso))));
create policy "movimentacao: leitura da rede" on public.movimentacoes_estoque as PERMISSIVE for SELECT to public using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT vejo_todas_unidades() AS vejo_todas_unidades) OR (sucursal_id = ( SELECT minha_sucursal_ref() AS minha_sucursal_ref)))));
create policy "notas: altera com permissao" on public.notas_entrada as PERMISSIVE for UPDATE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('estoque/notas-entrada'::text) AS posso))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('estoque/notas-entrada'::text) AS posso)));
create policy "notas: apaga so gestor" on public.notas_entrada as PERMISSIVE for DELETE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT sou_gestor() AS sou_gestor)));
create policy "notas: grava com permissao" on public.notas_entrada as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT posso('estoque/notas-entrada'::text) AS posso)));
create policy "notas: leitura da rede" on public.notas_entrada as PERMISSIVE for SELECT to authenticated using ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "pedbase itens: grava com o pedido" on public.pedido_base_itens as PERMISSIVE for ALL to authenticated using ((pedido_id IN ( SELECT pedidos_base.id
   FROM pedidos_base
  WHERE (( SELECT minha_rede_plena() AS minha_rede_plena) OR (pedidos_base.loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[])))))) with check ((pedido_id IN ( SELECT pedidos_base.id
   FROM pedidos_base
  WHERE (( SELECT minha_rede_plena() AS minha_rede_plena) OR (pedidos_base.loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))))));
create policy "pedbase itens: rede le" on public.pedido_base_itens as PERMISSIVE for SELECT to authenticated using ((pedido_id IN ( SELECT pedidos_base.id
   FROM pedidos_base
  WHERE (( SELECT minha_rede_plena() AS minha_rede_plena) OR (pedidos_base.loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))))));
create policy "pedbase: quem tem a tela grava" on public.pedidos_base as PERMISSIVE for ALL to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('controle/pedido-base'::text) AS posso) OR ( SELECT posso('controle/pedidos-recebidos'::text) AS posso)))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT posso('controle/pedido-base'::text) AS posso) OR ( SELECT posso('controle/pedidos-recebidos'::text) AS posso))));
create policy "pedbase: rede le" on public.pedidos_base as PERMISSIVE for SELECT to authenticated using ((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))));
create policy "plataforma altera loja" on public.lojas as PERMISSIVE for UPDATE to authenticated using (( SELECT sou_plataforma() AS sou_plataforma)) with check (( SELECT sou_plataforma() AS sou_plataforma));
create policy "plataforma cria loja" on public.lojas as PERMISSIVE for INSERT to authenticated with check (( SELECT sou_plataforma() AS sou_plataforma));
create policy "so a plataforma altera contrato" on public.clientes_nexor as PERMISSIVE for UPDATE to authenticated using (( SELECT sou_plataforma() AS sou_plataforma)) with check (( SELECT sou_plataforma() AS sou_plataforma));
create policy "so a plataforma apaga contrato" on public.clientes_nexor as PERMISSIVE for DELETE to authenticated using (( SELECT sou_plataforma() AS sou_plataforma));
create policy "so a plataforma grava contrato" on public.clientes_nexor as PERMISSIVE for INSERT to authenticated with check (( SELECT sou_plataforma() AS sou_plataforma));
create policy "unidades: rede le, plataforma le tudo" on public.sucursais as PERMISSIVE for SELECT to authenticated using ((( SELECT sou_plataforma() AS sou_plataforma) OR (( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[])))));
create policy "unidades: so a matriz altera" on public.sucursais as PERMISSIVE for UPDATE to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT sou_admin() AS sou_admin) OR ( SELECT sou_plataforma() AS sou_plataforma)))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT sou_admin() AS sou_admin) OR ( SELECT sou_plataforma() AS sou_plataforma))));
create policy "unidades: so a matriz cria" on public.sucursais as PERMISSIVE for INSERT to authenticated with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (( SELECT sou_admin() AS sou_admin) OR ( SELECT sou_plataforma() AS sou_plataforma))));
create policy "unidades: so a plataforma apaga" on public.sucursais as PERMISSIVE for DELETE to authenticated using (( SELECT sou_plataforma() AS sou_plataforma));
create policy "usuarios: cada um le o proprio" on public.usuarios_sistema as PERMISSIVE for SELECT to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND (lower(login) = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))));
create policy "usuarios: gerente da unidade administra a equipe" on public.usuarios_sistema as PERMISSIVE for ALL to authenticated using (((( SELECT minha_unidade_gerente() AS minha_unidade_gerente) IS NOT NULL) AND (loja_id = ( SELECT minha_loja() AS minha_loja)) AND (sucursais = jsonb_build_array(( SELECT minha_unidade_gerente() AS minha_unidade_gerente))) AND (lower(login) <> lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text))) AND (NOT COALESCE(tudo, false)) AND (NOT COALESCE(mestre, false)) AND login_da_minha_equipe(loja_id, login))) with check (((( SELECT minha_unidade_gerente() AS minha_unidade_gerente) IS NOT NULL) AND (loja_id = ( SELECT minha_loja() AS minha_loja)) AND (sucursais = jsonb_build_array(( SELECT minha_unidade_gerente() AS minha_unidade_gerente))) AND (lower(login) <> lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text))) AND (NOT COALESCE(tudo, false)) AND (NOT COALESCE(mestre, false)) AND login_da_minha_equipe(loja_id, login)));
create policy "usuarios: gestor administra" on public.usuarios_sistema as PERMISSIVE for ALL to authenticated using (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT sou_gestor() AS sou_gestor) AND (( SELECT sou_admin() AS sou_admin) OR ( SELECT sou_plataforma() AS sou_plataforma) OR (sucursais ? COALESCE(( SELECT perfis.sucursal_ref
   FROM perfis
  WHERE (perfis.id = ( SELECT auth.uid() AS uid))), ''::text))))) with check (((( SELECT minha_rede_plena() AS minha_rede_plena) OR (loja_id = ANY (( SELECT minhas_lojas() AS minhas_lojas)::uuid[]))) AND ( SELECT sou_gestor() AS sou_gestor) AND (( SELECT sou_admin() AS sou_admin) OR ( SELECT sou_plataforma() AS sou_plataforma) OR (sucursais ? COALESCE(( SELECT perfis.sucursal_ref
   FROM perfis
  WHERE (perfis.id = ( SELECT auth.uid() AS uid))), ''::text)))));
create policy "ve lojas da empresa" on public.lojas as PERMISSIVE for SELECT to authenticated using (((empresa_id = ( SELECT minha_empresa() AS minha_empresa)) OR ( SELECT sou_plataforma() AS sou_plataforma)));
create policy "ve o proprio perfil" on public.perfis as PERMISSIVE for SELECT to public using ((id = ( SELECT auth.uid() AS uid)));
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
