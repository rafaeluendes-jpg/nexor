'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api, can, getUser } from '../../lib/api';
import { usarTempoReal } from '../../lib/tempoReal';
import { quandoFoi, sinalDeEntrega } from '../../lib/formato';

interface ConversaLista {
  id: string;
  mode: 'AI' | 'HUMAN';
  owner: { id: string; name: string } | null;
  lastMessageAt: string | null;
  contact: { name: string; phone: string; city: string | null };
  lead: { id: string; stage: string; score: number; temperatura: string } | null;
  preview: string | null;
}

interface Detalhe {
  id: string;
  mode: 'AI' | 'HUMAN';
  owner: { id: string; name: string } | null;
  contact: { name: string | null; phone: string; city: string | null; state: string | null };
  lead: {
    id: string;
    stage: { key: string; name: string };
    score: number;
    temperature: string;
    desiredCity: string | null;
    capitalRange: string | null;
    investmentHorizon: string | null;
    businessExperience: string | null;
    availability: string | null;
    owner: { name: string } | null;
    createdAt: string;
    lastContactAt: string | null;
    origem: { source: string | null; campaign: string | null; content: string | null } | null;
    respostas: { pergunta: string; valor: string }[];
  } | null;
  anuncio: { headline: string | null; sourceUrl: string | null } | null;
  messages: {
    id: string;
    direction: 'INBOUND' | 'OUTBOUND';
    author: string;
    body: string | null;
    status: string;
    createdAt: string;
  }[];
}

export default function InboxPage() {
  const [lista, setLista] = useState<ConversaLista[]>([]);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const user = typeof window !== 'undefined' ? getUser() : null;

  const carregarLista = useCallback(() => {
    api<ConversaLista[]>('/conversations')
      .then((r) => {
        setLista(r);
        setAtiva((atual) => atual ?? r[0]?.id ?? null);
      })
      .catch((e: Error) => setErro(e.message));
  }, []);

  const carregarDetalhe = useCallback((id: string) => {
    api<Detalhe>(`/conversations/${id}`)
      .then(setDetalhe)
      .catch((e: Error) => setErro(e.message));
  }, []);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    if (!ativa) return;
    carregarDetalhe(ativa);
  }, [ativa, carregarDetalhe]);

  // Mensagem que chega, status que muda, conversa assumida: a tela reage sozinha.
  const { ligado } = usarTempoReal(
    ['mensagem_nova', 'mensagem_status', 'conversa_assumida', 'conversa_liberada', 'lead_novo'],
    useCallback(() => {
      carregarLista();
      if (ativa) carregarDetalhe(ativa);
    }, [ativa, carregarLista, carregarDetalhe]),
  );

  // Rede caiu ou o navegador cortou o fluxo: continuamos atualizando de tempos em tempos.
  useEffect(() => {
    if (ligado) return;
    const t = setInterval(() => {
      carregarLista();
      if (ativa) carregarDetalhe(ativa);
    }, 15_000);
    return () => clearInterval(t);
  }, [ligado, ativa, carregarLista, carregarDetalhe]);

  const assumir = () => {
    if (!ativa) return;
    api(`/conversations/${ativa}/takeover`, { method: 'POST', body: JSON.stringify({}) })
      .then(() => carregarDetalhe(ativa))
      .catch((e: Error) => setErro(e.message));
  };

  const devolver = () => {
    if (!ativa) return;
    api(`/conversations/${ativa}/release`, { method: 'POST', body: JSON.stringify({}) })
      .then(() => carregarDetalhe(ativa))
      .catch((e: Error) => setErro(e.message));
  };

  const responder = () => {
    if (!ativa || !texto.trim()) return;
    api(`/conversations/${ativa}/reply`, { method: 'POST', body: JSON.stringify({ body: texto }) })
      .then(() => {
        setTexto('');
        carregarDetalhe(ativa);
      })
      .catch((e: Error) => setErro(e.message));
  };

  return (
    <Shell>
      <h1>Conversas</h1>
      <p className="sub">
        WhatsApp oficial, com histórico completo de cada lead.{' '}
        <span className={ligado ? 'tempo-real ligado' : 'tempo-real'}>
          {ligado ? 'atualizando sozinho' : 'reconectando…'}
        </span>
      </p>
      {erro ? <div className="painel" style={{ marginBottom: 12 }}>{erro}</div> : null}
      <div className="inbox">
        <div className="coluna">
          <h2>Conversas</h2>
          {lista.length === 0 ? (
            <div className="vazio">Nenhuma conversa ainda.</div>
          ) : (
            lista.map((c) => (
              <button
                key={c.id}
                type="button"
                className="conversa"
                aria-selected={c.id === ativa}
                onClick={() => setAtiva(c.id)}
              >
                <b>{c.contact.name}</b>
                <small>
                  {c.contact.phone} · {c.mode === 'AI' ? 'IA atendendo' : `com ${c.owner?.name ?? 'humano'}`}
                  {c.lastMessageAt ? ` · ${quandoFoi(c.lastMessageAt)}` : ''}
                </small>
                <small className="previa">{c.preview ?? 'sem mensagens'}</small>
              </button>
            ))
          )}
        </div>

        <div className="coluna" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>{detalhe?.contact.name ?? 'Conversa'}</h2>
          <div className="mensagens" style={{ flex: 1 }}>
            {detalhe?.messages.map((m) => (
              <div key={m.id} className={`msg ${m.direction === 'INBOUND' ? 'IN' : 'OUT'}`}>
                {m.body}
                <span className="meta">
                  {m.direction === 'OUTBOUND'
                    ? `${m.author === 'AI' ? 'IA' : 'Time'} · ${sinalDeEntrega(m.status).simbolo} ${sinalDeEntrega(m.status).texto}`
                    : 'Cliente'}
                  {' · '}
                  {quandoFoi(m.createdAt)}
                </span>
              </div>
            ))}
            {detalhe && detalhe.messages.length === 0 ? <div className="vazio">Sem mensagens.</div> : null}
          </div>
          <div className="responder">
            {detalhe?.mode === 'AI' ? (
              <button className="btn secundario" type="button" onClick={assumir} disabled={!can(user, 'crm.conversations.takeover')}>
                Assumir conversa
              </button>
            ) : (
              <button className="btn secundario" type="button" onClick={devolver} disabled={!can(user, 'crm.conversations.takeover')}>
                Devolver para a IA
              </button>
            )}
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva a resposta…"
              onKeyDown={(e) => e.key === 'Enter' && responder()}
            />
            <button className="btn" type="button" onClick={responder} disabled={!can(user, 'crm.conversations.reply')}>
              Enviar
            </button>
          </div>
        </div>

        <div className="coluna perfil">
          <h2>Lead</h2>
          {detalhe?.lead ? (
            <dl>
              <div>
                <dt>Nome</dt>
                <dd>{detalhe.contact.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{detalhe.contact.phone}</dd>
              </div>
              <div>
                <dt>Cidade desejada</dt>
                <dd>{detalhe.lead.desiredCity ?? '—'}</dd>
              </div>
              <div>
                <dt>Capital</dt>
                <dd>{detalhe.lead.capitalRange ?? '—'}</dd>
              </div>
              <div>
                <dt>Prazo</dt>
                <dd>{detalhe.lead.investmentHorizon ?? '—'}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>
                  {detalhe.lead.score} <span className={`tag ${detalhe.lead.temperature}`}>{detalhe.lead.temperature}</span>
                </dd>
              </div>
              <div>
                <dt>Etapa</dt>
                <dd>{detalhe.lead.stage.name}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>
                  {detalhe.lead.origem?.source ?? 'direto'}
                  {detalhe.lead.origem?.campaign ? ` · ${detalhe.lead.origem.campaign}` : ''}
                </dd>
              </div>
              {detalhe.anuncio?.headline ? (
                <div>
                  <dt>Anúncio</dt>
                  <dd>{detalhe.anuncio.headline}</dd>
                </div>
              ) : null}
              <div>
                <dt>Responsável</dt>
                <dd>{detalhe.lead.owner?.name ?? 'sem responsável'}</dd>
              </div>
              <div>
                <dt>Ficha completa</dt>
                <dd>
                  <a href={`/leads/${detalhe.lead.id}`}>Abrir o lead</a>
                </dd>
              </div>
            </dl>
          ) : (
            <div className="vazio">Selecione uma conversa.</div>
          )}
        </div>
      </div>
    </Shell>
  );
}
