'use client';

import { use, useState } from 'react';
import { Shell } from '../../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../../components/Estado';
import { usarApi } from '../../../lib/usarApi';
import { api, ApiError } from '../../../lib/api';
import { data, dataHora, rotulo } from '../../../lib/formato';

interface Ficha {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  etapa: { key: string; name: string };
  status: string;
  score: number;
  temperatura: string;
  responsavel: { id: string; name: string } | null;
  qualificacao: Record<string, string | boolean | null>;
  respostas: { pergunta: string; resposta: string; em: string }[];
  origem: { origem: string; campanha: string | null; anuncio: string | null; primeiraVisita: string | null };
  tarefas: { id: string; titulo: string; prazo: string | null; status: string }[];
  reunioes: { id: string; titulo: string; quando: string; status: string }[];
  documentos: { id: string; nome: string; categoria: string; em: string }[];
  cof: { id: string; status: string; enviadaEm: string | null; recebidaEm: string | null; prazoDias: number }[];
  conversas: { id: string; modo: string; ultimaMensagem: string | null }[];
  motivoDaPerda: string | null;
  criadoEm: string;
  ultimoContato: string | null;
}

interface Evento {
  at: string;
  tipo: string;
  titulo: string;
  detalhe?: string;
}

const ETAPAS = [
  'NOVO_LEAD', 'IA_QUALIFICANDO', 'QUALIFICADO', 'REUNIAO_AGENDADA', 'APRESENTACAO_REALIZADA',
  'VISITA_UNIDADE', 'COF_ENVIADA', 'PRAZO_COF', 'NEGOCIACAO', 'CONTRATO', 'GANHO', 'PERDIDO',
  'NUTRICAO', 'SEM_RESPOSTA',
];

const NOMES_DE_CAMPO: Record<string, string> = {
  cidadeInteresse: 'Cidade onde quer abrir',
  estadoInteresse: 'Estado',
  faixaDeCapital: 'Capital disponivel',
  prazoParaInvestir: 'Prazo para investir',
  experiencia: 'Experiencia empresarial',
  temSocio: 'Tem socio',
  disponibilidade: 'Disponibilidade',
  melhorHorario: 'Melhor horario para falar',
};

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ficha = usarApi<Ficha>(`/leads/${id}`);
  const linha = usarApi<{ eventos: Evento[] }>(`/leads/${id}/timeline`);
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);

  const moverPara = async (etapa: string): Promise<void> => {
    setSalvando(true);
    setRecado(null);
    try {
      await api(`/leads/${id}/stage`, { method: 'POST', body: JSON.stringify({ stageKey: etapa }) });
      ficha.recarregar();
      linha.recarregar();
      setRecado({ texto: 'Etapa alterada.', tipo: 'ok' });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Nao foi possivel mudar a etapa.';
      setRecado({ texto: msg, tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  const recalcular = async (): Promise<void> => {
    setSalvando(true);
    try {
      await api(`/leads/${id}/score`, { method: 'POST' });
      ficha.recarregar();
      setRecado({ texto: 'Pontuacao recalculada.', tipo: 'ok' });
    } catch (e) {
      setRecado({ texto: e instanceof Error ? e.message : 'Falhou.', tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  if (ficha.carregando) return <Shell><Carregando o="a ficha do lead" /></Shell>;
  if (ficha.erro) return <Shell><Erro mensagem={ficha.erro} /></Shell>;
  if (!ficha.dados) return <Shell><Vazio texto="Lead nao encontrado." /></Shell>;

  const l = ficha.dados;

  return (
    <Shell>
      <h1>{l.nome}</h1>
      <p className="sub">
        {l.telefone} · entrou em {data(l.criadoEm)} · <span className={`tag ${l.temperatura}`}>{rotulo(l.temperatura)}</span>{' '}
        score {l.score}
      </p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="etapa">Etapa</label>
          <select id="etapa" value={l.etapa.key} disabled={salvando} onChange={(e) => void moverPara(e.target.value)}>
            {ETAPAS.map((e) => (
              <option key={e} value={e}>{rotulo(e)}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn secundario" disabled={salvando} onClick={() => void recalcular()}>
          Recalcular pontuacao
        </button>
        {l.conversas[0] ? (
          <a className="btn secundario" href={`/inbox?conversa=${l.conversas[0].id}`}>
            Abrir conversa
          </a>
        ) : null}
      </div>

      <div className="duas-colunas">
        <section className="painel">
          <h2>Linha do tempo</h2>
          {linha.carregando ? <Carregando o="o historico" /> : null}
          {linha.dados && linha.dados.eventos.length === 0 ? <Vazio texto="Ainda sem movimento." /> : null}
          <ul className="linha-do-tempo">
            {linha.dados?.eventos
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <strong>{e.titulo}</strong>
                  {e.detalhe ? <div>{e.detalhe}</div> : null}
                  <small>{dataHora(e.at)}</small>
                </li>
              ))}
          </ul>
        </section>

        <aside style={{ display: 'grid', gap: 16 }}>
          <section className="painel">
            <h2>Qualificacao</h2>
            <dl className="perfil" style={{ padding: 0 }}>
              {Object.entries(NOMES_DE_CAMPO).map(([chave, nome]) => {
                const v = l.qualificacao[chave];
                const texto = v === true ? 'Sim' : v === false ? 'Nao' : (v ?? '—');
                return (
                  <div key={chave}>
                    <dt>{nome}</dt>
                    <dd>{String(texto)}</dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section className="painel">
            <h2>Origem</h2>
            <dl className="perfil" style={{ padding: 0 }}>
              <div><dt>Veio de</dt><dd>{l.origem.origem}</dd></div>
              <div><dt>Campanha</dt><dd>{l.origem.campanha ?? '—'}</dd></div>
              <div><dt>Anuncio</dt><dd>{l.origem.anuncio ?? '—'}</dd></div>
              <div><dt>Primeira visita</dt><dd>{data(l.origem.primeiraVisita)}</dd></div>
              <div><dt>Responsavel</dt><dd>{l.responsavel?.name ?? 'sem responsavel'}</dd></div>
            </dl>
          </section>

          <section className="painel">
            <h2>Reunioes</h2>
            {l.reunioes.length === 0 ? <Vazio texto="Nenhuma reuniao." /> : (
              <ul className="linha-do-tempo">
                {l.reunioes.map((r) => (
                  <li key={r.id}>
                    <strong>{r.titulo}</strong>
                    <small>{dataHora(r.quando)} · {rotulo(r.status)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="painel">
            <h2>Tarefas</h2>
            {l.tarefas.length === 0 ? <Vazio texto="Nenhuma tarefa." /> : (
              <ul className="linha-do-tempo">
                {l.tarefas.map((t) => (
                  <li key={t.id}>
                    <strong>{t.titulo}</strong>
                    <small>{t.prazo ? `prazo ${data(t.prazo)}` : 'sem prazo'} · {rotulo(t.status)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="painel">
            <h2>COF e documentos</h2>
            {l.cof.length === 0 && l.documentos.length === 0 ? (
              <Vazio texto="Nada enviado ainda." />
            ) : (
              <ul className="linha-do-tempo">
                {l.cof.map((c) => (
                  <li key={c.id}>
                    <strong>COF · {rotulo(c.status)}</strong>
                    <small>
                      {c.enviadaEm ? `enviada ${data(c.enviadaEm)}` : 'nao enviada'}
                      {c.recebidaEm ? ` · recebida ${data(c.recebidaEm)}` : ''}
                    </small>
                  </li>
                ))}
                {l.documentos.map((d) => (
                  <li key={d.id}>
                    <strong>{d.nome}</strong>
                    <small>{rotulo(d.categoria)} · {data(d.em)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </Shell>
  );
}
