'use client';

import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { numero, porcentagem } from '../../lib/formato';

interface Grupo {
  leads: number;
  ganhos: number;
  conversao: number;
}

interface Relatorio {
  periodo: { de: string; ate: string };
  totais: {
    leads: number; qualificados: number; reunioes: number; cofs: number;
    contratos: number; ganhos: number; perdidos: number; scoreMedio: number;
  };
  conversao: {
    leadParaQualificado: number; leadParaReuniao: number;
    reuniaoParaCof: number; cofParaContrato: number; leadParaGanho: number;
  };
  tempos: {
    primeiraRespostaMin: number | null;
    qualificacaoHoras: number | null;
    porEtapaDias: { etapa: string; mediaDias: number; leads: number }[];
  };
  porCampanha: (Grupo & { campanha: string })[];
  porOrigem: (Grupo & { origem: string })[];
  porCidade: (Grupo & { cidade: string })[];
  porResponsavel: (Grupo & { responsavel: string })[];
  leadsParados: { id: string; nome: string; etapa: string; diasParado: number }[];
  motivosDePerda: { motivo: string; quantidade: number }[];
  iaParaHumano: { total: number; porMotivo: { motivo: string; quantidade: number }[] };
}

/** Tabela de conversao, usada para campanha, origem, cidade e responsavel. */
function TabelaDeGrupo({ titulo, coluna, linhas }: {
  titulo: string;
  coluna: string;
  linhas: { chave: string; leads: number; ganhos: number; conversao: number }[];
}) {
  return (
    <section className="painel" style={{ marginBottom: 16 }}>
      <h2>{titulo}</h2>
      {linhas.length === 0 ? (
        <Vazio texto="Ainda sem dados neste período." />
      ) : (
        <table>
          <thead>
            <tr><th>{coluna}</th><th>Leads</th><th>Ganhos</th><th>Conversão</th></tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave}>
                <td>{l.chave}</td>
                <td>{numero(l.leads)}</td>
                <td>{numero(l.ganhos)}</td>
                <td>{porcentagem(l.conversao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function RelatoriosPage() {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const caminho = useMemo(() => {
    const p = new URLSearchParams();
    if (de) p.set('de', de);
    if (ate) p.set('ate', ate);
    return `/reports?${p.toString()}`;
  }, [de, ate]);

  const { dados, carregando, erro } = usarApi<Relatorio>(caminho);

  return (
    <Shell>
      <h1>Relatórios</h1>
      <p className="sub">Como o funil está se comportando. Sem período escolhido, mostra os ultimos 90 dias.</p>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="de">De</label>
          <input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="ate">Até</label>
          <input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      {carregando ? <Carregando o="os números" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}

      {dados ? (
        <>
          <div className="cards">
            <div className="card"><b>{numero(dados.totais.leads)}</b><span>Leads</span></div>
            <div className="card"><b>{numero(dados.totais.qualificados)}</b><span>Qualificados</span></div>
            <div className="card"><b>{numero(dados.totais.reunioes)}</b><span>Reuniões</span></div>
            <div className="card"><b>{numero(dados.totais.cofs)}</b><span>COFs</span></div>
            <div className="card"><b>{numero(dados.totais.contratos)}</b><span>Contratos</span></div>
            <div className="card"><b>{numero(dados.totais.ganhos)}</b><span>Ganhos</span></div>
            <div className="card"><b>{numero(dados.totais.perdidos)}</b><span>Perdidos</span></div>
            <div className="card"><b>{numero(dados.totais.scoreMedio, 1)}</b><span>Score médio</span></div>
          </div>

          <section className="painel" style={{ marginBottom: 16 }}>
            <h2>Conversão entre etapas</h2>
            <table>
              <tbody>
                <tr><td>Lead → qualificado</td><td><strong>{porcentagem(dados.conversao.leadParaQualificado)}</strong></td></tr>
                <tr><td>Lead → reunião</td><td><strong>{porcentagem(dados.conversao.leadParaReuniao)}</strong></td></tr>
                <tr><td>Reunião → COF</td><td><strong>{porcentagem(dados.conversao.reuniaoParaCof)}</strong></td></tr>
                <tr><td>COF → contrato</td><td><strong>{porcentagem(dados.conversao.cofParaContrato)}</strong></td></tr>
                <tr><td>Lead → franqueado</td><td><strong>{porcentagem(dados.conversao.leadParaGanho)}</strong></td></tr>
              </tbody>
            </table>
          </section>

          <section className="painel" style={{ marginBottom: 16 }}>
            <h2>Tempo</h2>
            <table>
              <tbody>
                <tr>
                  <td>Primeira resposta ao candidato</td>
                  <td><strong>{dados.tempos.primeiraRespostaMin === null ? '—' : `${numero(dados.tempos.primeiraRespostaMin, 1)} min`}</strong></td>
                </tr>
                <tr>
                  <td>Até qualificar</td>
                  <td><strong>{dados.tempos.qualificacaoHoras === null ? '—' : `${numero(dados.tempos.qualificacaoHoras, 1)} h`}</strong></td>
                </tr>
                {dados.tempos.porEtapaDias.map((e) => (
                  <tr key={e.etapa}>
                    <td>Parado em “{e.etapa}”</td>
                    <td><strong>{numero(e.mediaDias, 1)} dias</strong> <span className="sub">({e.leads} leads)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <TabelaDeGrupo titulo="Por campanha" coluna="Campanha" linhas={dados.porCampanha.map((x) => ({ ...x, chave: x.campanha }))} />
          <TabelaDeGrupo titulo="Por origem" coluna="Origem" linhas={dados.porOrigem.map((x) => ({ ...x, chave: x.origem }))} />
          <TabelaDeGrupo titulo="Por cidade" coluna="Cidade" linhas={dados.porCidade.map((x) => ({ ...x, chave: x.cidade }))} />
          <TabelaDeGrupo titulo="Por responsável" coluna="Responsável" linhas={dados.porResponsavel.map((x) => ({ ...x, chave: x.responsavel }))} />

          <section className="painel" style={{ marginBottom: 16 }}>
            <h2>Leads parados</h2>
            {dados.leadsParados.length === 0 ? (
              <Vazio texto="Nenhum lead esquecido. Bom sinal." />
            ) : (
              <table>
                <thead><tr><th>Lead</th><th>Etapa</th><th>Parado ha</th></tr></thead>
                <tbody>
                  {dados.leadsParados.map((l) => (
                    <tr key={l.id}>
                      <td><a href={`/leads/${l.id}`}>{l.nome}</a></td>
                      <td>{l.etapa}</td>
                      <td>
                        <span className={l.diasParado >= 7 ? 'pilula perigo' : 'pilula atencao'}>
                          {l.diasParado} dia(s)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="duas-colunas">
            <section className="painel">
              <h2>Motivos de perda</h2>
              {dados.motivosDePerda.length === 0 ? <Vazio texto="Nenhuma perda registrada." /> : (
                <table>
                  <tbody>
                    {dados.motivosDePerda.map((m) => (
                      <tr key={m.motivo}><td>{m.motivo}</td><td><strong>{m.quantidade}</strong></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="painel">
              <h2>IA passou para uma pessoa</h2>
              <p className="sub">{numero(dados.iaParaHumano.total)} vez(es) no periodo.</p>
              {dados.iaParaHumano.porMotivo.length === 0 ? <Vazio texto="Nenhuma passagem." /> : (
                <table>
                  <tbody>
                    {dados.iaParaHumano.porMotivo.map((m) => (
                      <tr key={m.motivo}><td>{m.motivo}</td><td><strong>{m.quantidade}</strong></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      ) : null}
    </Shell>
  );
}
