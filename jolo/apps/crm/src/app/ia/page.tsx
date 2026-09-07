'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';

interface ConfiguracaoIa {
  ligada: boolean;
  respondeForaDoHorario: boolean;
  maxPerguntasAntesDeHumano: number;
  assinatura: string;
}

interface Mensagens {
  saudacao: string;
  foraDoHorario: string;
  transferencia: string;
}

const FERRAMENTAS = [
  ['Ler o lead', 'ver o que já se sabe da pessoa'],
  ['Atualizar o lead', 'gravar cidade, capital e prazo'],
  ['Guardar resposta', 'registrar cada resposta da qualificação'],
  ['Mover etapa', 'andar com o lead no funil'],
  ['Criar tarefa', 'deixar trabalho para o time'],
  ['Deixar observação', 'anotar algo no lead'],
  ['Marcar reunião', 'registrar interesse e horário'],
  ['Passar para uma pessoa', 'chamar o time e se calar'],
  ['Consultar dúvidas comuns', 'responder com dado aprovado'],
  ['Consultar cidades livres', 'dizer onde ainda dá para abrir'],
];

export default function IaPage() {
  const config = usarApi<{ configuracoes: { ia_sdr: ConfiguracaoIa; mensagens: Mensagens } }>('/settings');
  const [ia, setIa] = useState<ConfiguracaoIa | null>(null);
  const [msgs, setMsgs] = useState<Mensagens | null>(null);
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (config.dados) {
      setIa(config.dados.configuracoes.ia_sdr);
      setMsgs(config.dados.configuracoes.mensagens);
    }
  }, [config.dados]);

  const salvar = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!ia || !msgs) return;
    setSalvando(true);
    setRecado(null);
    try {
      await api('/settings/ia_sdr', { method: 'PUT', body: JSON.stringify(ia) });
      await api('/settings/mensagens', { method: 'PUT', body: JSON.stringify(msgs) });
      setRecado({ texto: 'Configuração salva.', tipo: 'ok' });
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para salvar.', tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  if (config.carregando) return <Shell><Carregando o="a configuração da IA" /></Shell>;
  if (config.erro) return <Shell><Erro mensagem={config.erro} /></Shell>;
  if (!ia || !msgs) return <Shell><Carregando /></Shell>;

  return (
    <Shell>
      <h1>IA de atendimento</h1>
      <p className="sub">
        Ela faz o primeiro contato, pergunta o que precisa e passa para uma pessoa na hora certa.
      </p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      <form className="painel" onSubmit={(e) => void salvar(e)} style={{ marginBottom: 16 }}>
        <fieldset>
          <legend>Comportamento</legend>
          <div className="campo">
            <label>
              <input type="checkbox" checked={ia.ligada} onChange={(e) => setIa({ ...ia, ligada: e.target.checked })} />{' '}
              A IA responde as mensagens que chegam
            </label>
          </div>
          <div className="campo">
            <label>
              <input
                type="checkbox"
                checked={ia.respondeForaDoHorario}
                onChange={(e) => setIa({ ...ia, respondeForaDoHorario: e.target.checked })}
              />{' '}
              Responder tambem fora do horario de atendimento
            </label>
          </div>
          <div className="campo">
            <label htmlFor="max">Quantas perguntas antes de chamar uma pessoa</label>
            <input
              id="max"
              type="number"
              min={1}
              max={50}
              value={ia.maxPerguntasAntesDeHumano}
              onChange={(e) => setIa({ ...ia, maxPerguntasAntesDeHumano: Number(e.target.value) })}
            />
          </div>
          <div className="campo">
            <label htmlFor="assin">Como ela se apresenta</label>
            <input id="assin" value={ia.assinatura} onChange={(e) => setIa({ ...ia, assinatura: e.target.value })} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Mensagens</legend>
          <div className="campo">
            <label htmlFor="saud">Primeira mensagem</label>
            <textarea id="saud" value={msgs.saudacao} onChange={(e) => setMsgs({ ...msgs, saudacao: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="fora">Fora do horário</label>
            <textarea id="fora" value={msgs.foraDoHorario} onChange={(e) => setMsgs({ ...msgs, foraDoHorario: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="transf">Ao passar para uma pessoa</label>
            <textarea id="transf" value={msgs.transferencia} onChange={(e) => setMsgs({ ...msgs, transferencia: e.target.value })} />
          </div>
        </fieldset>

        <div className="linha-botoes">
          <button className="btn" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>

      <section className="painel">
        <h2>O que a IA pode fazer</h2>
        <p className="sub">
          Ela não mexe no banco de dados. Faz apenas estas dez coisas, e cada uma confere o que recebe.
        </p>
        <table>
          <tbody>
            {FERRAMENTAS.map(([nome, oque]) => (
              <tr key={nome}><td><strong>{nome}</strong></td><td>{oque}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="sub" style={{ marginTop: 12 }}>
          Quando alguem do time assume a conversa, a IA para de responder ali na hora.
        </p>
      </section>
    </Shell>
  );
}
