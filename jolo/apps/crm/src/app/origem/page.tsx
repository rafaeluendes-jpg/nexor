'use client';

import { Shell } from '../../components/Shell';
import { Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { numero, porcentagem } from '../../lib/formato';

interface Relatorio {
  totais: { leads: number; ganhos: number };
  porOrigem: { origem: string; leads: number; ganhos: number; conversao: number }[];
  porCampanha: { campanha: string; leads: number; ganhos: number; conversao: number }[];
}

/** Barra proporcional: da para ver de longe quem traz mais gente. */
function Barra({ parte, total }: { parte: number; total: number }) {
  const largura = total ? Math.round((parte / total) * 100) : 0;
  return (
    <div className="barra" title={`${largura}%`}>
      <span style={{ width: `${largura}%` }} />
    </div>
  );
}

export default function OrigemPage() {
  const { dados, carregando, erro } = usarApi<Relatorio>('/reports');

  return (
    <Shell>
      <h1>Origem dos leads</h1>
      <p className="sub">
        De onde vem quem procura a franquia. A origem e sempre a primeira: quem trouxe a pessoa
        continua com o credito, mesmo que ela volte depois por outro caminho.
      </p>

      {carregando ? <Carregando o="a origem dos leads" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}

      {dados ? (
        <>
          <section className="painel" style={{ marginBottom: 16 }}>
            <h2>Por canal</h2>
            {dados.porOrigem.length === 0 ? <Vazio texto="Ainda sem leads." /> : (
              <table>
                <thead><tr><th>Canal</th><th>Leads</th><th>Participacao</th><th>Ganhos</th><th>Conversao</th></tr></thead>
                <tbody>
                  {dados.porOrigem.map((o) => (
                    <tr key={o.origem}>
                      <td><strong>{o.origem}</strong></td>
                      <td>{numero(o.leads)}</td>
                      <td style={{ minWidth: 140 }}><Barra parte={o.leads} total={dados.totais.leads} /></td>
                      <td>{numero(o.ganhos)}</td>
                      <td>{porcentagem(o.conversao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="painel">
            <h2>Por campanha</h2>
            {dados.porCampanha.length === 0 ? <Vazio texto="Nenhuma campanha identificada." /> : (
              <table>
                <thead><tr><th>Campanha</th><th>Leads</th><th>Participacao</th><th>Ganhos</th><th>Conversao</th></tr></thead>
                <tbody>
                  {dados.porCampanha.map((c) => (
                    <tr key={c.campanha}>
                      <td><strong>{c.campanha}</strong></td>
                      <td>{numero(c.leads)}</td>
                      <td style={{ minWidth: 140 }}><Barra parte={c.leads} total={dados.totais.leads} /></td>
                      <td>{numero(c.ganhos)}</td>
                      <td>{porcentagem(c.conversao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </Shell>
  );
}
