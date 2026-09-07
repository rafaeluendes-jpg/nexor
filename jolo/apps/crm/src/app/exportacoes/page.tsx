'use client';

import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';
import { dataHora, numero, rotulo } from '../../lib/formato';

interface Exportacao {
  id: string;
  status: string;
  linhas: number | null;
  arquivo: string | null;
  versao: number | null;
  pedidoPor: string | null;
  criadoEm: string;
  concluidoEm: string | null;
}

export default function ExportacoesPage() {
  const { dados, carregando, erro, recarregar } = usarApi<Exportacao[]>('/excel/exports');
  const [pedindo, setPedindo] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);

  const pedir = async (): Promise<void> => {
    setPedindo(true);
    setRecado(null);
    try {
      await api('/excel/export', { method: 'POST', body: JSON.stringify({}) });
      setRecado({ texto: 'Exportacao pedida. Ela e gerada em segundo plano; atualize daqui a pouco.', tipo: 'ok' });
      recarregar();
    } catch (e) {
      setRecado({ texto: e instanceof Error ? e.message : 'Nao deu para pedir.', tipo: 'erro' });
    } finally {
      setPedindo(false);
    }
  };

  return (
    <Shell>
      <h1>Exportacoes</h1>
      <p className="sub">Planilha com uma linha por lead, para acompanhar por fora do sistema.</p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      <div className="linha-botoes" style={{ marginBottom: 18 }}>
        <button className="btn" type="button" disabled={pedindo} onClick={() => void pedir()}>
          {pedindo ? 'Pedindo…' : 'Gerar planilha agora'}
        </button>
        <button className="btn secundario" type="button" onClick={recarregar}>Atualizar lista</button>
      </div>

      {carregando ? <Carregando o="as exportacoes" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.length === 0 ? <Vazio texto="Nenhuma planilha gerada ainda." /> : null}

      {dados && dados.length > 0 ? (
        <div className="painel">
          <table>
            <thead>
              <tr><th>Pedido em</th><th>Situacao</th><th>Linhas</th><th>Versao</th><th>Pedido por</th><th>Concluido</th></tr>
            </thead>
            <tbody>
              {dados.map((e) => (
                <tr key={e.id}>
                  <td>{dataHora(e.criadoEm)}</td>
                  <td>
                    <span className={e.status === 'done' ? 'pilula ok' : e.status === 'failed' ? 'pilula perigo' : 'pilula'}>
                      {rotulo(e.status)}
                    </span>
                  </td>
                  <td>{e.linhas === null ? '—' : numero(e.linhas)}</td>
                  <td>{e.versao ?? '—'}</td>
                  <td>{e.pedidoPor ?? '—'}</td>
                  <td>{dataHora(e.concluidoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sub" style={{ marginTop: 12 }}>
            A planilha fica no armazenamento do servidor. Para receber por e-mail ou salvar na nuvem,
            e preciso ligar essa integracao — depende de conta externa.
          </p>
        </div>
      ) : null}
    </Shell>
  );
}
