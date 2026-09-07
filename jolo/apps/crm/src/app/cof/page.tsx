'use client';

import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';
import { data, rotulo } from '../../lib/formato';

interface Processo {
  id: string;
  status: string;
  enviadaEm: string | null;
  recebidaEm: string | null;
  prazoDias: number;
  versao: string | null;
  observacoes: string | null;
  lead: { id: string; nome: string; cidade: string | null };
  documentos: { id: string; nome: string; em: string }[];
  prazoTermina: string | null;
  diasRestantes: number | null;
  contratoLiberado: boolean;
  alerta: string | null;
}

export default function CofPage() {
  const [status, setStatus] = useState('');
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const caminho = useMemo(() => `/cof?${new URLSearchParams(status ? { status } : {}).toString()}`, [status]);
  const { dados, carregando, erro, recarregar } = usarApi<{ itens: Processo[] }>(caminho);

  const acao = async (id: string, rota: string, texto: string): Promise<void> => {
    setOcupado(true);
    setRecado(null);
    try {
      await api(`/cof/${id}/${rota}`, { method: 'POST', body: JSON.stringify({}) });
      setRecado({ texto, tipo: 'ok' });
      recarregar();
    } catch (e) {
      // o erro do prazo legal e informacao util: mostramos como veio
      setRecado({ texto: e instanceof Error ? e.message : 'Não deu para registrar.', tipo: 'erro' });
    } finally {
      setOcupado(false);
    }
  };

  const emAlerta = dados?.itens.filter((c) => c.alerta) ?? [];

  return (
    <Shell>
      <h1>COF</h1>
      <p className="sub">
        Circular de Oferta de Franquia. O contrato só libera depois do prazo legal a partir da data de recebimento.
      </p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}
      {emAlerta.map((c) => (
        <Aviso key={c.id} texto={`${c.lead.nome}: ${c.alerta}`} />
      ))}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="status">Situação</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            <option value="NAO_ENVIADA">Não enviada</option>
            <option value="ENVIADA">Enviada</option>
            <option value="EM_PRAZO">No prazo legal</option>
            <option value="CONTRATO_LIBERADO">Contrato liberado</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>

      {carregando ? <Carregando o="os processos" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio texto="Nenhuma COF aberta. Abra pela ficha do lead quando chegar a hora." />
      ) : null}

      {dados && dados.itens.length > 0 ? (
        <div className="painel">
          <table>
            <thead>
              <tr>
                <th>Candidato</th><th>Situação</th><th>Enviada</th><th>Recebida</th>
                <th>Prazo termina</th><th>Faltam</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`/leads/${c.lead.id}`}><strong>{c.lead.nome}</strong></a>
                    <div className="sub" style={{ margin: 0 }}>{c.lead.cidade ?? '—'}</div>
                  </td>
                  <td>{rotulo(c.status)}</td>
                  <td>{data(c.enviadaEm)}</td>
                  <td>{data(c.recebidaEm)}</td>
                  <td>{data(c.prazoTermina)}</td>
                  <td>
                    {c.diasRestantes === null ? (
                      '—'
                    ) : c.contratoLiberado ? (
                      <span className="pilula ok">prazo cumprido</span>
                    ) : (
                      <span className={c.diasRestantes <= 2 ? 'pilula atencao' : 'pilula'}>
                        {c.diasRestantes} dia(s)
                      </span>
                    )}
                  </td>
                  <td className="acoes">
                    {!c.enviadaEm ? (
                      <button type="button" disabled={ocupado} onClick={() => void acao(c.id, 'envio', 'Envio registrado.')}>
                        Registrar envio
                      </button>
                    ) : null}
                    {c.enviadaEm && !c.recebidaEm ? (
                      <button type="button" disabled={ocupado} onClick={() => void acao(c.id, 'recebimento', 'Recebimento registrado. O prazo comecou a correr.')}>
                        Registrar recebimento
                      </button>
                    ) : null}
                    {c.recebidaEm && c.status !== 'CONTRATO_LIBERADO' ? (
                      <button
                        type="button"
                        className="primario"
                        disabled={ocupado}
                        onClick={() => void acao(c.id, 'liberar-contrato', 'Contrato liberado.')}
                      >
                        Liberar contrato
                      </button>
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
