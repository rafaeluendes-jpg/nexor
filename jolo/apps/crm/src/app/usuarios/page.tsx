'use client';

import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';
import { dataHora, rotulo } from '../../lib/formato';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  status: string;
  papeis: string[];
  ultimoAcesso: string | null;
  sessoesAtivas: number;
  criadoEm: string;
}

const PAPEIS = [
  { chave: 'SUPER_ADMIN', nome: 'Super admin', o_que: 'Tudo, inclusive apagar lead' },
  { chave: 'ADMIN', nome: 'Admin', o_que: 'Tudo, menos apagar lead' },
  { chave: 'EXPANSAO', nome: 'Expansão', o_que: 'Leads, conversas, funil, reuniões, documentos' },
  { chave: 'ATENDENTE', nome: 'Atendente', o_que: 'Conversas e leads' },
  { chave: 'MARKETING', nome: 'Marketing', o_que: 'Campanhas, origem e relatórios' },
  { chave: 'VISUALIZACAO', nome: 'Visualização', o_que: 'Só olha' },
];

/** Senha provisoria forte, gerada aqui para ninguem inventar "123456". */
function senhaProvisoria(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

export default function UsuariosPage() {
  const { dados, carregando, erro, recarregar } = usarApi<Usuario[]>('/users');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState('EXPANSAO');
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [senhaParaEntregar, setSenhaParaEntregar] = useState<string | null>(null);

  const criar = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSalvando(true);
    setRecado(null);
    setSenhaParaEntregar(null);
    const senha = senhaProvisoria();
    try {
      await api('/users', { method: 'POST', body: JSON.stringify({ nome, email, papel, senhaProvisoria: senha }) });
      setNome('');
      setEmail('');
      // mostrada uma vez, para o gestor entregar em maos; nao fica guardada em lugar nenhum
      setSenhaParaEntregar(senha);
      setRecado({ texto: 'Usuário criado.', tipo: 'ok' });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para criar.', tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  const mudarPapel = async (id: string, novo: string): Promise<void> => {
    try {
      await api(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ papel: novo }) });
      setRecado({ texto: 'Papel alterado.', tipo: 'ok' });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para alterar.', tipo: 'erro' });
    }
  };

  const mudarStatus = async (id: string, ativo: boolean): Promise<void> => {
    try {
      await api(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ ativo }) });
      setRecado({ texto: ativo ? 'Acesso liberado.' : 'Acesso bloqueado.', tipo: 'ok' });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para alterar.', tipo: 'erro' });
    }
  };

  const encerrarSessoes = async (id: string): Promise<void> => {
    try {
      await api(`/users/${id}/revoke-sessions`, { method: 'POST', body: JSON.stringify({}) });
      setRecado({ texto: 'Sessões encerradas. A pessoa precisa entrar de novo.', tipo: 'ok' });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para encerrar.', tipo: 'erro' });
    }
  };

  return (
    <Shell>
      <h1>Usuários e acessos</h1>
      <p className="sub">Quem entra no CRM e o que cada um pode fazer. Quem decide e o servidor, não a tela.</p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}
      {senhaParaEntregar ? (
        <div className="aviso">
          <strong>Senha provisoria:</strong> <code>{senhaParaEntregar}</code>
          <div>Entregue em maos e peca para trocar no primeiro acesso. Ela não aparece de novo.</div>
        </div>
      ) : null}

      <form className="painel" onSubmit={(e) => void criar(e)} style={{ marginBottom: 18 }}>
        <h2>Novo usuário</h2>
        <div className="filtros" style={{ marginBottom: 0 }}>
          <div className="campo">
            <label htmlFor="nome">Nome</label>
            <input id="nome" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ minWidth: 240 }} />
          </div>
          <div className="campo">
            <label htmlFor="papel">Papel</label>
            <select id="papel" value={papel} onChange={(e) => setPapel(e.target.value)}>
              {PAPEIS.map((p) => (
                <option key={p.chave} value={p.chave}>{p.nome}</option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit" disabled={salvando}>{salvando ? 'Criando…' : 'Criar'}</button>
        </div>
        <p className="sub" style={{ margin: 0 }}>
          {PAPEIS.find((p) => p.chave === papel)?.o_que}
        </p>
      </form>

      {carregando ? <Carregando o="os usuários" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.length === 0 ? <Vazio texto="Nenhum usuário." /> : null}

      {dados && dados.length > 0 ? (
        <div className="painel">
          <div className="tabela-rolagem"><table>
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th><th>Último acesso</th><th>Sessões</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {dados.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nome}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.papeis[0] ?? ''} onChange={(e) => void mudarPapel(u.id, e.target.value)}>
                      {PAPEIS.map((p) => (
                        <option key={p.chave} value={p.chave}>{p.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={u.status === 'ACTIVE' ? 'pilula ok' : 'pilula perigo'}>{rotulo(u.status)}</span>
                  </td>
                  <td>{dataHora(u.ultimoAcesso)}</td>
                  <td>{u.sessoesAtivas}</td>
                  <td className="acoes">
                    <button type="button" onClick={() => void mudarStatus(u.id, u.status !== 'ACTIVE')}>
                      {u.status === 'ACTIVE' ? 'Bloquear' : 'Liberar'}
                    </button>
                    {u.sessoesAtivas > 0 ? (
                      <button type="button" onClick={() => void encerrarSessoes(u.id)}>Encerrar sessões</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ) : null}

      <section className="painel" style={{ marginTop: 16 }}>
        <h2>O que cada papel pode</h2>
        <div className="tabela-rolagem"><table>
          <thead><tr><th>Papel</th><th>Alcance</th></tr></thead>
          <tbody>
            {PAPEIS.map((p) => (
              <tr key={p.chave}><td><strong>{p.nome}</strong></td><td>{p.o_que}</td></tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </Shell>
  );
}
