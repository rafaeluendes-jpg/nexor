'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';

interface Horario {
  diasDaSemana: number[];
  horaInicio: string;
  horaFim: string;
  fusoHorario: string;
}

interface Roteamento {
  modo: string;
  responsavelPadraoId: string | null;
  rodizio: string[];
  porChave: Record<string, string>;
}

interface Regra {
  id: string;
  chave: string;
  rotulo: string;
  pontos: number;
  ativa: boolean;
}

interface Usuario {
  id: string;
  nome: string;
  status: string;
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const MODOS = [
  { chave: 'RESPONSAVEL_FIXO', nome: 'Sempre a mesma pessoa' },
  { chave: 'RODIZIO', nome: 'Rodizio entre o time' },
  { chave: 'POR_CIDADE', nome: 'Pela cidade do candidato' },
  { chave: 'POR_ESTADO', nome: 'Pelo estado do candidato' },
  { chave: 'POR_CAMPANHA', nome: 'Pela campanha que trouxe' },
  { chave: 'MANUAL', nome: 'Ninguem: fica na fila geral' },
];

export default function ConfiguracoesPage() {
  const cfg = usarApi<{ configuracoes: { horario_atendimento: Horario; roteamento_de_leads: Roteamento } }>('/settings');
  const regras = usarApi<{ somaDosPesos: number; regras: Regra[] }>('/score-rules');
  const usuarios = usarApi<Usuario[]>('/users');

  const [horario, setHorario] = useState<Horario | null>(null);
  const [rot, setRot] = useState<Roteamento | null>(null);
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (cfg.dados) {
      setHorario(cfg.dados.configuracoes.horario_atendimento);
      setRot(cfg.dados.configuracoes.roteamento_de_leads);
    }
  }, [cfg.dados]);

  const salvar = async (chave: string, valor: unknown, texto: string): Promise<void> => {
    setSalvando(true);
    setRecado(null);
    try {
      await api(`/settings/${chave}`, { method: 'PUT', body: JSON.stringify(valor) });
      setRecado({ texto, tipo: 'ok' });
    } catch (e) {
      setRecado({ texto: e instanceof Error ? e.message : 'Nao deu para salvar.', tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  const mudarPeso = async (id: string, pontos: number): Promise<void> => {
    try {
      await api(`/score-rules/${id}`, { method: 'PATCH', body: JSON.stringify({ pontos }) });
      regras.recarregar();
    } catch (e) {
      setRecado({ texto: e instanceof Error ? e.message : 'Nao deu para alterar.', tipo: 'erro' });
    }
  };

  if (cfg.carregando) return <Shell><Carregando o="as configuracoes" /></Shell>;
  if (cfg.erro) return <Shell><Erro mensagem={cfg.erro} /></Shell>;
  if (!horario || !rot) return <Shell><Carregando /></Shell>;

  const ativos = (usuarios.dados ?? []).filter((u) => u.status === 'ACTIVE');

  return (
    <Shell>
      <h1>Configuracoes</h1>
      <p className="sub">As regras do negocio ficam aqui, nao no codigo. Mudou aqui, vale na hora.</p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      <section className="painel" style={{ marginBottom: 16 }}>
        <h2>Horario de atendimento</h2>
        <p className="sub">Serve para a IA saber quando ha gente para atender.</p>
        <div className="filtros">
          {DIAS.map((d, i) => (
            <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={horario.diasDaSemana.includes(i)}
                onChange={(e) =>
                  setHorario({
                    ...horario,
                    diasDaSemana: e.target.checked
                      ? [...horario.diasDaSemana, i].sort()
                      : horario.diasDaSemana.filter((x) => x !== i),
                  })
                }
              />
              {d}
            </label>
          ))}
          <div className="campo">
            <label htmlFor="ini">Das</label>
            <input id="ini" type="time" value={horario.horaInicio} onChange={(e) => setHorario({ ...horario, horaInicio: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="fim">Ate</label>
            <input id="fim" type="time" value={horario.horaFim} onChange={(e) => setHorario({ ...horario, horaFim: e.target.value })} />
          </div>
          <button
            className="btn"
            type="button"
            disabled={salvando}
            onClick={() => void salvar('horario_atendimento', horario, 'Horario salvo.')}
          >
            Salvar horario
          </button>
        </div>
      </section>

      <section className="painel" style={{ marginBottom: 16 }}>
        <h2>Quem atende o lead novo</h2>
        <div className="filtros">
          <div className="campo">
            <label htmlFor="modo">Regra</label>
            <select id="modo" value={rot.modo} onChange={(e) => setRot({ ...rot, modo: e.target.value })}>
              {MODOS.map((m) => (
                <option key={m.chave} value={m.chave}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="padrao">Responsavel padrao</label>
            <select
              id="padrao"
              value={rot.responsavelPadraoId ?? ''}
              onChange={(e) => setRot({ ...rot, responsavelPadraoId: e.target.value || null })}
            >
              <option value="">Ninguem</option>
              {ativos.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          <button
            className="btn"
            type="button"
            disabled={salvando}
            onClick={() => void salvar('roteamento_de_leads', rot, 'Regra de atendimento salva.')}
          >
            Salvar regra
          </button>
        </div>
        {rot.modo === 'RODIZIO' ? (
          <div>
            <p className="sub">No rodizio, cada lead novo vai para o proximo da lista. Marque quem participa:</p>
            <div className="filtros">
              {ativos.map((u) => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={rot.rodizio.includes(u.id)}
                    onChange={(e) =>
                      setRot({
                        ...rot,
                        rodizio: e.target.checked ? [...rot.rodizio, u.id] : rot.rodizio.filter((x) => x !== u.id),
                      })
                    }
                  />
                  {u.nome}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {rot.modo === 'MANUAL' ? (
          <Aviso texto="Nesse modo o lead entra sem dono e fica na fila geral. Ele nao some, mas alguem precisa pegar." />
        ) : null}
      </section>

      <section className="painel">
        <h2>Pesos da pontuacao</h2>
        <p className="sub">
          O que faz um lead ser quente. Soma atual: <strong>{regras.dados?.somaDosPesos ?? 0}</strong> pontos
          {regras.dados && regras.dados.somaDosPesos !== 100 ? ' — fora de 100, o "score" perde a referencia.' : '.'}
        </p>
        {regras.carregando ? <Carregando o="os pesos" /> : null}
        {regras.dados ? (
          <table>
            <thead><tr><th>Criterio</th><th>Peso</th></tr></thead>
            <tbody>
              {regras.dados.regras.map((r) => (
                <tr key={r.id}>
                  <td>{r.rotulo}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={r.pontos}
                      style={{ width: 90 }}
                      onBlur={(e) => {
                        const novo = Number(e.target.value);
                        if (novo !== r.pontos) void mudarPeso(r.id, novo);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </Shell>
  );
}
