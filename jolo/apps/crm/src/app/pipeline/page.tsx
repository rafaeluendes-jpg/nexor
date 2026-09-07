'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../lib/api';

interface Board {
  pipeline?: string;
  colunas: {
    key: string;
    nome: string;
    total: number;
    cartoes: {
      leadId: string;
      nome: string;
      telefone: string;
      cidade: string | null;
      score: number;
      temperatura: string;
      origem: string;
      responsavel: string | null;
      diasNaEtapa: number;
    }[];
  }[];
}

export default function PipelinePage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Board>('/pipeline')
      .then(setBoard)
      .catch((e: Error) => setErro(e.message));
  }, []);

  return (
    <Shell>
      <h1>Funil de expansão</h1>
      <p className="sub">Cada coluna é uma etapa. O histórico de movimentação fica guardado no lead.</p>
      {erro ? <div className="painel">{erro}</div> : null}
      <div className="kanban">
        {board?.colunas.map((c) => (
          <div className="col" key={c.key}>
            <h3>
              {c.nome} · {c.total}
            </h3>
            {c.cartoes.map((card) => (
              <div className="cartao" key={card.leadId}>
                <b>{card.nome}</b>
                <small>{card.telefone}</small>
                <small>{card.cidade ?? 'cidade não informada'}</small>
                <small>
                  score {card.score} · <span className={`tag ${card.temperatura}`}>{card.temperatura}</span>
                </small>
                <small>
                  {card.origem} · {card.diasNaEtapa}d na etapa
                </small>
              </div>
            ))}
            {c.cartoes.length === 0 ? <small style={{ color: 'var(--muted)' }}>vazio</small> : null}
          </div>
        ))}
      </div>
    </Shell>
  );
}
