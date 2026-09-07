'use client';

import { Shell } from '../../components/Shell';
import { Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { numero, porcentagem } from '../../lib/formato';

interface Metrics {
  leads: { hoje: number; semana: number; mes: number; abertos: number; total: number };
  funil: { qualificados: number; reunioes: number; cofs: number; contratos: number; ganhos: number; perdidos: number };
  pendencias: { tarefasAbertas: number; proximasReunioes: number; cofsEmPrazo: number };
  taxaConversao: number;
  origens: { origem: string; leads: number }[];
  serie: { dia: string; leads: number }[];
  etapas: { chave: string; nome: string; leads: number }[];
}

/** Escala de um tom só, clara → escura: a cor mostra a ordem do processo. */
const RAMPA = ['var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)', 'var(--g5)', 'var(--g6)', 'var(--g7)'];

/** Etapas que formam o caminho até a venda; as outras são desfechos. */
const CAMINHO = [
  'NOVO_LEAD', 'IA_QUALIFICANDO', 'QUALIFICADO', 'REUNIAO_AGENDADA',
  'APRESENTACAO_REALIZADA', 'VISITA_UNIDADE', 'COF_ENVIADA', 'PRAZO_COF',
  'NEGOCIACAO', 'CONTRATO', 'GANHO',
];

function diaCurto(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function DashboardPage() {
  const { dados, carregando, erro } = usarApi<Metrics>('/dashboard');

  if (carregando) return <Shell><Carregando o="o painel" /></Shell>;
  if (erro) return <Shell><Erro mensagem={erro} /></Shell>;
  if (!dados) return <Shell><Vazio texto="Sem dados." /></Shell>;

  const maiorDia = Math.max(1, ...dados.serie.map((d) => d.leads));
  const etapasDoCaminho = dados.etapas.filter((e) => CAMINHO.includes(e.chave));
  const maiorEtapa = Math.max(1, ...etapasDoCaminho.map((e) => e.leads));
  const maiorOrigem = Math.max(1, ...dados.origens.map((o) => o.leads));
  const pendenciasTotal =
    dados.pendencias.tarefasAbertas + dados.pendencias.proximasReunioes + dados.pendencias.cofsEmPrazo;

  return (
    <Shell>
      <h1>Painel</h1>
      <p className="sub">Como está a expansão hoje.</p>

      <div className="destaques">
        <div className="item"><b>{numero(dados.leads.hoje)}</b><span>Leads hoje</span></div>
        <div className="item"><b>{numero(dados.leads.semana)}</b><span>Na semana</span></div>
        <div className="item"><b>{numero(dados.leads.mes)}</b><span>No mês</span></div>
        <div className="item"><b>{numero(dados.leads.abertos)}</b><span>Em aberto</span></div>
        <div className="item"><b>{numero(dados.funil.ganhos)}</b><span>Franqueados</span></div>
        <div className="item"><b>{porcentagem(dados.taxaConversao)}</b><span>Conversão</span></div>
      </div>

      {pendenciasTotal > 0 ? (
        <div className="pendencias">
          <a href="/tarefas">
            <span className="n">{numero(dados.pendencias.tarefasAbertas)}</span>
            <span className="oque">tarefa(s) esperando alguém do time</span>
            <span className="seta" aria-hidden="true">→</span>
          </a>
          <a href="/agenda">
            <span className="n">{numero(dados.pendencias.proximasReunioes)}</span>
            <span className="oque">reunião(ões) marcada(s) daqui para frente</span>
            <span className="seta" aria-hidden="true">→</span>
          </a>
          <a href="/cof">
            <span className="n">{numero(dados.pendencias.cofsEmPrazo)}</span>
            <span className="oque">COF(s) com o prazo legal correndo</span>
            <span className="seta" aria-hidden="true">→</span>
          </a>
        </div>
      ) : null}

      <div className="duas-colunas">
        <section className="painel">
          <h2>
            Leads que chegaram
            <span className="rotulo">últimos 14 dias</span>
          </h2>
          {dados.serie.every((d) => d.leads === 0) ? (
            <Vazio texto="Nenhum lead entrou nos últimos 14 dias." />
          ) : (
            <div className="grafico">
              <div className="serie" role="img" aria-label={`Leads por dia nos últimos 14 dias. Maior dia: ${maiorDia}.`}>
                {dados.serie.map((d, i) => (
                  <div
                    key={d.dia}
                    className={i === dados.serie.length - 1 ? 'col hoje' : 'col'}
                    style={{ height: `${Math.max(2, (d.leads / maiorDia) * 100)}%` }}
                    title={`${diaCurto(d.dia)}: ${d.leads} lead(s)`}
                  />
                ))}
              </div>
              <div className="eixo">
                <span>{diaCurto(dados.serie[0]?.dia ?? '')}</span>
                <span>hoje · {numero(dados.serie[dados.serie.length - 1]?.leads ?? 0)}</span>
              </div>
            </div>
          )}

          <h2 style={{ marginTop: 26 }}>Onde estão os candidatos</h2>
          {etapasDoCaminho.every((e) => e.leads === 0) ? (
            <Vazio texto="Nenhum candidato no funil ainda." />
          ) : (
            <div className="barras">
              {etapasDoCaminho.map((e, i) => (
                <div className="barra-linha" key={e.chave}>
                  <span>{e.nome}</span>
                  <span className="barra-trilho">
                    <span
                      className="barra-preenche"
                      style={{
                        width: `${Math.max(e.leads ? 2 : 0, (e.leads / maiorEtapa) * 100)}%`,
                        // a cor acompanha a ordem da etapa: mais escuro = mais perto da venda
                        background: RAMPA[Math.min(RAMPA.length - 1, Math.round((i / Math.max(1, etapasDoCaminho.length - 1)) * (RAMPA.length - 1)))],
                      }}
                    />
                  </span>
                  <span className="barra-valor">{numero(e.leads)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside style={{ display: 'grid', gap: 18 }}>
          <section className="painel">
            <h2>De onde vêm</h2>
            {dados.origens.length === 0 ? (
              <Vazio texto="Ainda sem origem registrada." />
            ) : (
              <div className="barras">
                {[...dados.origens]
                  .sort((a, b) => b.leads - a.leads)
                  .map((o) => (
                    <div className="barra-linha" key={o.origem}>
                      <span>{o.origem}</span>
                      <span className="barra-trilho">
                        <span className="barra-preenche" style={{ width: `${(o.leads / maiorOrigem) * 100}%` }} />
                      </span>
                      <span className="barra-valor">{numero(o.leads)}</span>
                    </div>
                  ))}
              </div>
            )}
            <div className="linha-botoes">
              <a className="btn secundario" href="/origem">Ver por campanha</a>
            </div>
          </section>

          <section className="painel">
            <h2>Processo</h2>
            <div className="tabela-rolagem"><table>
              <tbody>
                <tr><td>Qualificados</td><td className="num linha-forte">{numero(dados.funil.qualificados)}</td></tr>
                <tr><td>Reuniões</td><td className="num linha-forte">{numero(dados.funil.reunioes)}</td></tr>
                <tr><td>COFs abertas</td><td className="num linha-forte">{numero(dados.funil.cofs)}</td></tr>
                <tr><td>Contratos liberados</td><td className="num linha-forte">{numero(dados.funil.contratos)}</td></tr>
                <tr><td>Perdidos</td><td className="num linha-forte">{numero(dados.funil.perdidos)}</td></tr>
              </tbody>
            </table></div>
          </section>
        </aside>
      </div>
    </Shell>
  );
}
