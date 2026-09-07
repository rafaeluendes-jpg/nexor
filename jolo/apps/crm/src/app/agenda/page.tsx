'use client';

import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';
import { dataHora, rotulo } from '../../lib/formato';

interface Reuniao {
  id: string;
  titulo: string;
  quando: string;
  duracaoMin: number;
  local: string | null;
  status: string;
  observacoes: string | null;
  responsavel: { id: string; nome: string } | null;
  lead: { id: string; nome: string; telefone: string | null; cidade: string | null };
}

const STATUS = ['AGENDADA', 'REALIZADA', 'CANCELADA', 'NAO_COMPARECEU'] as const;

export default function AgendaPage() {
  const [status, setStatus] = useState('AGENDADA');
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);

  const caminho = useMemo(
    () => `/meetings?${new URLSearchParams(status ? { status } : {}).toString()}`,
    [status],
  );
  const { dados, carregando, erro, recarregar } = usarApi<{ itens: Reuniao[] }>(caminho);

  const mudarStatus = async (id: string, novo: string): Promise<void> => {
    try {
      await api(`/meetings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: novo }) });
      setRecado({ texto: 'Reunião atualizada.', tipo: 'ok' });
      recarregar();
    } catch (e) {
      setRecado({ texto: e instanceof Error ? e.message : 'Não deu para atualizar.', tipo: 'erro' });
    }
  };

  const proximas = dados?.itens.filter((r) => new Date(r.quando).getTime() > Date.now()) ?? [];

  return (
    <Shell>
      <h1>Agenda</h1>
      <p className="sub">Reuniões e visitas marcadas com os candidatos.</p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}
      {status === 'AGENDADA' && proximas.length > 0 ? (
        <Aviso texto={`${proximas.length} reuniao(oes) ainda por acontecer. A proxima e ${dataHora(proximas[0]?.quando)}.`} tipo="ok" />
      ) : null}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="status">Mostrar</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map((s) => (
              <option key={s} value={s}>{rotulo(s)}</option>
            ))}
            <option value="">Todas</option>
          </select>
        </div>
      </div>

      <Aviso texto="Para marcar uma reunião, abra o lead na tela de Leads: assim ela já fica ligada a pessoa certa e move o funil sozinha." />

      {carregando ? <Carregando o="a agenda" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.itens.length === 0 ? <Vazio texto="Nada marcado por aqui." /> : null}

      {dados && dados.itens.length > 0 ? (
        <div className="painel">
          <table>
            <thead>
              <tr><th>Quando</th><th>Assunto</th><th>Candidato</th><th>Local</th><th>Responsável</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {dados.itens.map((r) => (
                <tr key={r.id}>
                  <td>{dataHora(r.quando)}<div className="sub" style={{ margin: 0 }}>{r.duracaoMin} min</div></td>
                  <td><strong>{r.titulo}</strong></td>
                  <td><a href={`/leads/${r.lead.id}`}>{r.lead.nome}</a><div className="sub" style={{ margin: 0 }}>{r.lead.cidade ?? '—'}</div></td>
                  <td>{r.local ?? '—'}</td>
                  <td>{r.responsavel?.nome ?? '—'}</td>
                  <td>{rotulo(r.status)}</td>
                  <td className="acoes">
                    {r.status === 'AGENDADA' ? (
                      <>
                        <button type="button" className="primario" onClick={() => void mudarStatus(r.id, 'REALIZADA')}>
                          Aconteceu
                        </button>
                        <button type="button" onClick={() => void mudarStatus(r.id, 'NAO_COMPARECEU')}>
                          Não veio
                        </button>
                        <button type="button" onClick={() => void mudarStatus(r.id, 'CANCELADA')}>
                          Cancelar
                        </button>
                      </>
                    ) : null}
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
