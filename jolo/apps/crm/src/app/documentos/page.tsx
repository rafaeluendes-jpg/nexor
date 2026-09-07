'use client';

import { useMemo, useRef, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { getToken } from '../../lib/api';
import { data, numero, rotulo } from '../../lib/formato';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface Documento {
  id: string;
  nome: string;
  categoria: string;
  tamanhoBytes: number | null;
  tipo: string | null;
  enviadoEm: string;
  enviadoPor: { id: string; nome: string } | null;
  lead: { id: string; nome: string } | null;
}

const CATEGORIAS = ['COF', 'CONTRATO', 'FICHA_QUALIFICACAO', 'DOCUMENTO_CANDIDATO', 'APRESENTACAO', 'COMPROVANTE', 'OUTRO'];

export default function DocumentosPage() {
  const [categoria, setCategoria] = useState('');
  const [envioCategoria, setEnvioCategoria] = useState('OUTRO');
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const caminho = useMemo(
    () => `/documents?${new URLSearchParams(categoria ? { categoria } : {}).toString()}`,
    [categoria],
  );
  const { dados, carregando, erro, recarregar } = usarApi<{ itens: Documento[] }>(caminho);

  const enviar = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const f = arquivo.current?.files?.[0];
    if (!f) return;

    setEnviando(true);
    setRecado(null);
    const corpo = new FormData();
    corpo.append('file', f);
    corpo.append('categoria', envioCategoria);
    try {
      // sem Content-Type manual: o navegador monta o limite do multipart sozinho
      const res = await fetch(`${BASE}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
        body: corpo,
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? 'Envio recusado.');
      setRecado({ texto: 'Documento guardado.', tipo: 'ok' });
      if (arquivo.current) arquivo.current.value = '';
      recarregar();
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Não deu para enviar.', tipo: 'erro' });
    } finally {
      setEnviando(false);
    }
  };

  /** O arquivo so sai pela rota com permissao: buscamos com o token e abrimos localmente. */
  const baixar = async (doc: Documento): Promise<void> => {
    try {
      const res = await fetch(`${BASE}/documents/${doc.id}/arquivo`, {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('Não foi possível baixar.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nome;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setRecado({ texto: err instanceof Error ? err.message : 'Falhou.', tipo: 'erro' });
    }
  };

  return (
    <Shell>
      <h1>Documentos</h1>
      <p className="sub">Guardados em area privada. Só sai daqui para quem tem permissão, e toda abertura fica registrada.</p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      <form className="painel" onSubmit={(e) => void enviar(e)} style={{ marginBottom: 18 }}>
        <h2>Enviar documento</h2>
        <div className="filtros" style={{ marginBottom: 0 }}>
          <div className="campo">
            <label htmlFor="arq">Arquivo (PDF, JPG, PNG, DOCX ou XLSX, ate 20 MB)</label>
            <input id="arq" type="file" ref={arquivo} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" required />
          </div>
          <div className="campo">
            <label htmlFor="cat">Categoria</label>
            <select id="cat" value={envioCategoria} onChange={(e) => setEnvioCategoria(e.target.value)}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{rotulo(c)}</option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
        </div>
      </form>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="filtro">Categoria</label>
          <select id="filtro" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{rotulo(c)}</option>
            ))}
          </select>
        </div>
      </div>

      {carregando ? <Carregando o="os documentos" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.itens.length === 0 ? <Vazio texto="Nenhum documento guardado." /> : null}

      {dados && dados.itens.length > 0 ? (
        <div className="painel">
          <div className="tabela-rolagem"><table>
            <thead>
              <tr><th>Arquivo</th><th>Categoria</th><th>Lead</th><th>Tamanho</th><th>Enviado por</th><th>Quando</th><th /></tr>
            </thead>
            <tbody>
              {dados.itens.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.nome}</strong></td>
                  <td>{rotulo(d.categoria)}</td>
                  <td>{d.lead ? <a href={`/leads/${d.lead.id}`}>{d.lead.nome}</a> : '—'}</td>
                  <td>{d.tamanhoBytes ? `${numero(Math.round(d.tamanhoBytes / 1024))} KB` : '—'}</td>
                  <td>{d.enviadoPor?.nome ?? '—'}</td>
                  <td>{data(d.enviadoEm)}</td>
                  <td className="acoes">
                    <button type="button" onClick={() => void baixar(d)}>Baixar</button>
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
