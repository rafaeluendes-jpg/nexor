'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro } from '../../components/Estado';
import { api, can, getUser } from '../../lib/api';
import { usarTempoReal } from '../../lib/tempoReal';

interface Cartao {
  leadId: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  score: number;
  temperatura: string;
  origem: string;
  responsavel: string | null;
  diasNaEtapa: number;
  proximaAcao: string | null;
}

interface Board {
  pipeline?: string;
  colunas: { key: string; nome: string; cor: string; total: number; cartoes: Cartao[] }[];
}

export default function PipelinePage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const user = typeof window !== 'undefined' ? getUser() : null;
  const podeMover = can(user, 'crm.pipeline.move');

  const carregar = useCallback(() => {
    api<Board>('/pipeline')
      .then((b) => {
        setBoard(b);
        setErro(null);
      })
      .catch((e: Error) => setErro(e.message));
  }, []);

  useEffect(carregar, [carregar]);

  const { ligado } = usarTempoReal(['lead_mudou_etapa', 'lead_novo'], carregar);

  useEffect(() => {
    if (ligado) return;
    const t = setInterval(carregar, 20_000);
    return () => clearInterval(t);
  }, [ligado, carregar]);

  const mover = async (leadId: string, etapa: string): Promise<void> => {
    setRecado(null);
    try {
      await api(`/leads/${leadId}/stage`, { method: 'POST', body: JSON.stringify({ stageKey: etapa }) });
      setRecado({ texto: 'Lead movido. A mudanca ficou registrada no historico dele.', tipo: 'ok' });
      carregar();
    } catch (e) {
      // regra de negocio (prazo da COF, por exemplo) chega aqui como recado claro
      setRecado({ texto: e instanceof Error ? e.message : 'Nao deu para mover.', tipo: 'erro' });
      carregar();
    }
  };

  return (
    <Shell>
      <h1>Funil de expansão</h1>
      <p className="sub">
        Cada coluna é uma etapa. Arraste o cartão para mudar — toda movimentação fica registrada no lead.{' '}
        <span className={ligado ? 'tempo-real ligado' : 'tempo-real'}>
          {ligado ? 'atualizando sozinho' : 'reconectando…'}
        </span>
      </p>

      {erro ? <Erro mensagem={erro} /> : null}
      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}
      {!podeMover ? <Aviso texto="Seu acesso permite ver o funil, mas nao mover cartao." /> : null}
      {!board && !erro ? <Carregando o="o funil" /> : null}

      <div className="kanban">
        {board?.colunas.map((c) => (
          <div
            className="col"
            key={c.key}
            style={alvo === c.key ? { outline: '2px dashed var(--bosco)' } : undefined}
            onDragOver={(e) => {
              if (!podeMover || !arrastando) return;
              e.preventDefault();
              setAlvo(c.key);
            }}
            onDragLeave={() => setAlvo((a) => (a === c.key ? null : a))}
            onDrop={(e) => {
              e.preventDefault();
              setAlvo(null);
              const leadId = arrastando ?? e.dataTransfer.getData('text/plain');
              setArrastando(null);
              if (leadId && podeMover) void mover(leadId, c.key);
            }}
          >
            <h3 style={{ borderTop: `3px solid ${c.cor}`, paddingTop: 8 }}>
              {c.nome} · {c.total}
            </h3>
            {c.cartoes.map((card) => (
              <div
                className="cartao"
                key={card.leadId}
                draggable={podeMover}
                onDragStart={(e) => {
                  setArrastando(card.leadId);
                  e.dataTransfer.setData('text/plain', card.leadId);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setArrastando(null);
                  setAlvo(null);
                }}
                style={{ cursor: podeMover ? 'grab' : 'default', opacity: arrastando === card.leadId ? 0.5 : 1 }}
              >
                <b>
                  <a href={`/leads/${card.leadId}`}>{card.nome}</a>
                </b>
                <small>{card.telefone}</small>
                <small>{card.cidade ?? 'cidade não informada'}</small>
                <small>
                  score {card.score} · <span className={`tag ${card.temperatura}`}>{card.temperatura}</span>
                </small>
                <small>
                  {card.origem} · {card.diasNaEtapa}d na etapa
                </small>
                <small>{card.responsavel ? `com ${card.responsavel}` : 'sem responsável'}</small>
                {/* selecionar a etapa tambem funciona: nem todo mundo arrasta bem no celular */}
                {podeMover ? (
                  <select
                    value={c.key}
                    aria-label={`Mover ${card.nome} de etapa`}
                    style={{ marginTop: 6, width: '100%', fontSize: 12 }}
                    onChange={(e) => void mover(card.leadId, e.target.value)}
                  >
                    {board.colunas.map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.nome}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ))}
            {c.cartoes.length === 0 ? <small style={{ color: 'var(--muted)' }}>vazio</small> : null}
          </div>
        ))}
      </div>
    </Shell>
  );
}
