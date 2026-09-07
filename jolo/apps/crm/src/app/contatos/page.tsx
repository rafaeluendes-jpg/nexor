'use client';

import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { data, numero, rotulo } from '../../lib/formato';

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string | null;
  criadoEm: string;
  lead: { id: string; etapa: string; score: number; temperatura: string } | null;
}

export default function ContatosPage() {
  const [busca, setBusca] = useState('');
  const caminho = useMemo(() => `/contacts?${new URLSearchParams(busca ? { busca } : {}).toString()}`, [busca]);
  const { dados, carregando, erro } = usarApi<{ total: number; itens: Contato[] }>(caminho);

  return (
    <Shell>
      <h1>Contatos</h1>
      <p className="sub">Todo telefone que já falou com a gente, sem repetir ninguem.</p>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="b">Nome ou telefone</label>
          <input id="b" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" />
        </div>
      </div>

      {carregando ? <Carregando o="os contatos" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.itens.length === 0 ? <Vazio texto="Nenhum contato encontrado." /> : null}

      {dados && dados.itens.length > 0 ? (
        <div className="painel">
          <p className="sub" style={{ margin: '0 0 12px' }}>{numero(dados.total)} contato(s).</p>
          <div className="tabela-rolagem"><table>
            <thead>
              <tr>
                <th>Nome</th><th>Telefone</th><th>Cidade</th><th>Etapa do lead</th><th>Score</th><th>Cadastrado</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.lead ? <a href={`/leads/${c.lead.id}`}><strong>{c.nome}</strong></a> : <strong>{c.nome}</strong>}
                  </td>
                  <td>{c.telefone}</td>
                  <td>{c.cidade ?? '—'}</td>
                  <td>{c.lead ? rotulo(c.lead.etapa) : '—'}</td>
                  <td>
                    {c.lead ? <span className={`tag ${c.lead.temperatura}`}>{c.lead.score}</span> : '—'}
                  </td>
                  <td>{data(c.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ) : null}
    </Shell>
  );
}
