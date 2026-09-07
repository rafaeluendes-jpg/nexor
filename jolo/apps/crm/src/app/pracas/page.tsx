'use client';

import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';
import { rotulo } from '../../lib/formato';

interface Praca {
  id: string;
  cidade: string;
  uf: string;
  status: string;
  disponivel: boolean;
  prioridade: number;
  observacoes: string | null;
  responsavel: { id: string; nome: string } | null;
  lead: { id: string; nome: string } | null;
}

const STATUS = ['DISPONIVEL', 'EM_ANALISE', 'NEGOCIACAO', 'RESERVADA', 'VENDIDA'];

export default function PracasPage() {
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);

  const caminho = useMemo(() => {
    const p = new URLSearchParams();
    if (filtro) p.set('status', filtro);
    if (busca) p.set('busca', busca);
    return `/territories?${p.toString()}`;
  }, [filtro, busca]);

  const { dados, carregando, erro, recarregar } = usarApi<{ resumo: Record<string, number>; itens: Praca[] }>(caminho);

  const criar = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await api('/territories', { method: 'POST', body: JSON.stringify({ cidade, uf: uf.toUpperCase() }) });
      setCidade('');
      setUf('');
      setRecado({ texto: 'Praça cadastrada.', tipo: 'ok' });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para cadastrar.', tipo: 'erro' });
    }
  };

  const mudar = async (id: string, status: string): Promise<void> => {
    try {
      await api(`/territories/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para atualizar.', tipo: 'erro' });
    }
  };

  return (
    <Shell>
      <h1>Praças</h1>
      <p className="sub">Cidades da rede: onde já tem loja, onde está em negociação e onde ainda da para abrir.</p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      {dados ? (
        <div className="cards">
          {STATUS.map((s) => (
            <div className="card" key={s}>
              <b>{dados.resumo[s] ?? 0}</b>
              <span>{rotulo(s)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <form className="painel" onSubmit={(e) => void criar(e)} style={{ marginBottom: 18 }}>
        <h2>Cadastrar praça</h2>
        <div className="filtros" style={{ marginBottom: 0 }}>
          <div className="campo">
            <label htmlFor="cidade">Cidade</label>
            <input id="cidade" required value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="uf">UF</label>
            <input id="uf" required maxLength={2} value={uf} onChange={(e) => setUf(e.target.value)} style={{ minWidth: 70 }} />
          </div>
          <button className="btn" type="submit">Cadastrar</button>
        </div>
      </form>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="f">Situação</label>
          <select id="f" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>{rotulo(s)}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="b">Cidade</label>
          <input id="b" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" />
        </div>
      </div>

      {carregando ? <Carregando o="as praças" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.itens.length === 0 ? <Vazio texto="Nenhuma praça cadastrada com esse filtro." /> : null}

      {dados && dados.itens.length > 0 ? (
        <div className="painel">
          <table>
            <thead>
              <tr><th>Cidade</th><th>UF</th><th>Situação</th><th>Responsável</th><th>Candidato</th><th>Mudar para</th></tr>
            </thead>
            <tbody>
              {dados.itens.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.cidade}</strong></td>
                  <td>{p.uf}</td>
                  <td>
                    <span className={p.disponivel ? 'pilula ok' : 'pilula'}>{rotulo(p.status)}</span>
                  </td>
                  <td>{p.responsavel?.nome ?? '—'}</td>
                  <td>{p.lead ? <a href={`/leads/${p.lead.id}`}>{p.lead.nome}</a> : '—'}</td>
                  <td>
                    <select value={p.status} onChange={(e) => void mudar(p.id, e.target.value)}>
                      {STATUS.map((s) => (
                        <option key={s} value={s}>{rotulo(s)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Shell>
  );
}
