'use client';

import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { data, numero, rotulo } from '../../lib/formato';

interface LeadDaLista {
  id: string;
  nome: string;
  telefone: string;
  cidadeInteresse: string | null;
  etapa: { key: string; name: string };
  score: number;
  temperatura: string;
  origem: string | null;
  campanha: string | null;
  responsavel: { id: string; name: string } | null;
  criadoEm: string;
  ultimoContato: string | null;
  status: string;
}

interface Resposta {
  total: number;
  leads: LeadDaLista[];
}

const ETAPAS = [
  'NOVO_LEAD', 'IA_QUALIFICANDO', 'QUALIFICADO', 'REUNIAO_AGENDADA', 'APRESENTACAO_REALIZADA',
  'VISITA_UNIDADE', 'COF_ENVIADA', 'PRAZO_COF', 'NEGOCIACAO', 'CONTRATO', 'GANHO', 'PERDIDO',
  'NUTRICAO', 'SEM_RESPOSTA',
];

export default function LeadsPage() {
  const [busca, setBusca] = useState('');
  const [etapa, setEtapa] = useState('');
  const [temperatura, setTemperatura] = useState('');
  const [cidade, setCidade] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const caminho = useMemo(() => {
    const p = new URLSearchParams();
    if (busca) p.set('search', busca);
    if (etapa) p.set('stage', etapa);
    if (temperatura) p.set('temperature', temperatura);
    if (cidade) p.set('city', cidade);
    if (de) p.set('from', de);
    if (ate) p.set('to', ate);
    p.set('take', '100');
    return `/leads?${p.toString()}`;
  }, [busca, etapa, temperatura, cidade, de, ate]);

  const { dados, carregando, erro } = usarApi<Resposta>(caminho);

  return (
    <Shell>
      <h1>Leads</h1>
      <p className="sub">Todo mundo que chegou pela pagina de franquias.</p>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="busca">Nome, telefone ou cidade</label>
          <input id="busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" />
        </div>
        <div className="campo">
          <label htmlFor="etapa">Etapa</label>
          <select id="etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
            <option value="">Todas</option>
            {ETAPAS.map((e) => (
              <option key={e} value={e}>{rotulo(e)}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="temp">Temperatura</label>
          <select id="temp" value={temperatura} onChange={(e) => setTemperatura(e.target.value)}>
            <option value="">Todas</option>
            <option value="QUENTE">Quente</option>
            <option value="MORNO">Morno</option>
            <option value="FRIO">Frio</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="cidade">Cidade</label>
          <input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
        </div>
        <div className="campo">
          <label htmlFor="de">De</label>
          <input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="ate">Até</label>
          <input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      {carregando ? <Carregando o="os leads" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}

      {dados ? (
        dados.leads.length === 0 ? (
          <Vazio texto="Nenhum lead com esses filtros." />
        ) : (
          <div className="painel">
            <p className="sub" style={{ margin: '0 0 12px' }}>
              {numero(dados.total)} lead(s) encontrados.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th>Etapa</th>
                  <th>Score</th>
                  <th>Temperatura</th>
                  <th>Origem</th>
                  <th>Responsável</th>
                  <th>Entrou em</th>
                </tr>
              </thead>
              <tbody>
                {dados.leads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <a href={`/leads/${l.id}`}>
                        <strong>{l.nome}</strong>
                      </a>
                    </td>
                    <td>{l.telefone}</td>
                    <td>{l.cidadeInteresse ?? '—'}</td>
                    <td>{l.etapa.name}</td>
                    <td>{l.score}</td>
                    <td>
                      <span className={`tag ${l.temperatura}`}>{rotulo(l.temperatura)}</span>
                    </td>
                    <td>{l.origem ?? 'direto'}</td>
                    <td>{l.responsavel?.name ?? '—'}</td>
                    <td>{data(l.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </Shell>
  );
}
