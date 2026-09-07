'use client';

import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';
import { data, rotulo } from '../../lib/formato';

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prazo: string | null;
  atrasada: boolean;
  responsavel: { id: string; nome: string } | null;
  lead: { id: string; nome: string } | null;
}

export default function TarefasPage() {
  const [status, setStatus] = useState('ABERTA');
  const [titulo, setTitulo] = useState('');
  const [prazo, setPrazo] = useState('');
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const caminho = useMemo(() => `/tasks?${new URLSearchParams(status ? { status } : {}).toString()}`, [status]);
  const { dados, carregando, erro, recarregar } = usarApi<{ itens: Tarefa[] }>(caminho);

  const criar = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSalvando(true);
    setRecado(null);
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          titulo,
          // o campo da tela e uma data; a API quer data e hora
          ...(prazo ? { prazo: new Date(`${prazo}T12:00:00`).toISOString() } : {}),
        }),
      });
      setTitulo('');
      setPrazo('');
      setRecado({ texto: 'Tarefa criada.', tipo: 'ok' });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para criar.', tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  const marcar = async (id: string, concluida: boolean): Promise<void> => {
    try {
      await api(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ concluida }) });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para atualizar.', tipo: 'erro' });
    }
  };

  const atrasadas = dados?.itens.filter((t) => t.atrasada).length ?? 0;

  return (
    <Shell>
      <h1>Tarefas</h1>
      <p className="sub">O que o time precisa fazer, com prazo.</p>

      {atrasadas > 0 ? <Aviso texto={`${atrasadas} tarefa(s) com prazo vencido.`} /> : null}
      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      <form className="painel" onSubmit={(e) => void criar(e)} style={{ marginBottom: 18 }}>
        <h2>Nova tarefa</h2>
        <div className="filtros" style={{ marginBottom: 0 }}>
          <div className="campo" style={{ flex: 1 }}>
            <label htmlFor="titulo">O que precisa ser feito</label>
            <input
              id="titulo"
              required
              minLength={3}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ligar para o candidato de Campinas"
              style={{ minWidth: 320 }}
            />
          </div>
          <div className="campo">
            <label htmlFor="prazo">Prazo</label>
            <input id="prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={salvando || titulo.trim().length < 3}>
            {salvando ? 'Salvando…' : 'Criar'}
          </button>
        </div>
      </form>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="status">Mostrar</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ABERTA">Abertas</option>
            <option value="CONCLUIDA">Concluidas</option>
            <option value="">Todas</option>
          </select>
        </div>
      </div>

      {carregando ? <Carregando o="as tarefas" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.itens.length === 0 ? <Vazio texto="Nenhuma tarefa aqui." /> : null}

      {dados && dados.itens.length > 0 ? (
        <div className="painel">
          <div className="tabela-rolagem"><table>
            <thead>
              <tr><th>Tarefa</th><th>Lead</th><th>Responsável</th><th>Prazo</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {dados.itens.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.titulo}</strong>{t.descricao ? <div className="sub" style={{ margin: 0 }}>{t.descricao}</div> : null}</td>
                  <td>{t.lead ? <a href={`/leads/${t.lead.id}`}>{t.lead.nome}</a> : '—'}</td>
                  <td>{t.responsavel?.nome ?? '—'}</td>
                  <td>
                    {data(t.prazo)}{' '}
                    {t.atrasada ? <span className="pilula perigo">vencida</span> : null}
                  </td>
                  <td>{rotulo(t.status)}</td>
                  <td className="acoes">
                    <button type="button" onClick={() => void marcar(t.id, t.status !== 'CONCLUIDA')}>
                      {t.status === 'CONCLUIDA' ? 'Reabrir' : 'Concluir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ) : null}
    </Shell>
  );
}
