'use client';

import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { api } from '../../lib/api';
import { rotulo } from '../../lib/formato';

interface Modelo {
  id: string;
  nome: string;
  categoria: string;
  idioma: string;
  texto: string;
  variaveis: number[];
  statusNaMeta: string;
  ativo: boolean;
}

export default function ModelosPage() {
  const { dados, carregando, erro, recarregar } = usarApi<{ integracaoConfigurada: boolean; itens: Modelo[] }>('/templates');
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('UTILITY');
  const [texto, setTexto] = useState('');
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const criar = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSalvando(true);
    setRecado(null);
    try {
      await api('/templates', { method: 'POST', body: JSON.stringify({ nome, categoria, texto }) });
      setNome('');
      setTexto('');
      setRecado({
        texto: 'Modelo guardado aqui. Agora cadastre o mesmo nome e texto no painel da Meta: e lá que ele e aprovado.',
        tipo: 'ok',
      });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para salvar.', tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  const ligar = async (id: string, ativo: boolean): Promise<void> => {
    try {
      await api(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo }) });
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para alterar.', tipo: 'erro' });
    }
  };

  return (
    <Shell>
      <h1>Modelos de mensagem</h1>
      <p className="sub">
        Fora da janela de 24 horas, o WhatsApp só deixa enviar mensagem de modelo aprovado pela Meta.
      </p>

      {dados && !dados.integracaoConfigurada ? (
        <Aviso texto="A integração com a Meta ainda não está configurada, então nenhum modelo envia de verdade. Veja a tela de Integração WhatsApp." />
      ) : null}
      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      <form className="painel" onSubmit={(e) => void criar(e)} style={{ marginBottom: 18 }}>
        <h2>Novo modelo</h2>
        <div className="filtros" style={{ marginBottom: 0 }}>
          <div className="campo">
            <label htmlFor="nome">Nome (minusculas e sublinhado)</label>
            <input
              id="nome"
              required
              pattern="[a-z0-9_]+"
              value={nome}
              onChange={(e) => setNome(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="lembrete_visita"
            />
          </div>
          <div className="campo">
            <label htmlFor="cat">Categoria</label>
            <select id="cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="UTILITY">Utilidade (lembrete, aviso)</option>
              <option value="MARKETING">Marketing (oferta, convite)</option>
              <option value="AUTHENTICATION">Autenticacao (codigo)</option>
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="texto">Texto — use {'{{1}}'}, {'{{2}}'} onde entra o nome, a data etc.</label>
          <textarea
            id="texto"
            required
            minLength={10}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Oi, {{1}}! Lembrete da sua visita à loja em {{2}}."
          />
        </div>
        <div className="linha-botoes">
          <button className="btn" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar modelo'}</button>
        </div>
      </form>

      {carregando ? <Carregando o="os modelos" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.itens.length === 0 ? <Vazio texto="Nenhum modelo cadastrado." /> : null}

      {dados && dados.itens.length > 0 ? (
        <div className="painel">
          <div className="tabela-rolagem"><table>
            <thead>
              <tr><th>Nome</th><th>Categoria</th><th>Texto</th><th>Variáveis</th><th>Na Meta</th><th>Uso</th></tr>
            </thead>
            <tbody>
              {dados.itens.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.nome}</strong><div className="sub" style={{ margin: 0 }}>{m.idioma}</div></td>
                  <td>{rotulo(m.categoria)}</td>
                  <td style={{ maxWidth: 380 }}>{m.texto}</td>
                  <td>{m.variaveis.length ? m.variaveis.join(', ') : '—'}</td>
                  <td>
                    <span className={m.statusNaMeta === 'APPROVED' ? 'pilula ok' : 'pilula atencao'}>
                      {m.statusNaMeta === 'APPROVED' ? 'aprovado' : 'pendente'}
                    </span>
                  </td>
                  <td className="acoes">
                    <button type="button" onClick={() => void ligar(m.id, !m.ativo)}>
                      {m.ativo ? 'Desativar' : 'Ativar'}
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
