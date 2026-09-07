'use client';

import { useRef, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { getToken } from '../../lib/api';
import { dataHora, numero } from '../../lib/formato';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

type Situacao = 'novo' | 'repetido_no_arquivo' | 'ja_existe' | 'sem_telefone' | 'telefone_invalido';

interface LinhaLida {
  linha: number;
  nome: string | null;
  telefoneOriginal: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  observacao: string | null;
  situacao: Situacao;
}

interface Conferencia {
  arquivo: string;
  totalDeLinhas: number;
  colunasEncontradas: Record<string, string | null>;
  linhas: LinhaLida[];
  resumo: Record<Situacao, number>;
}

interface Lote {
  id: string;
  arquivo: string;
  rotulo: string;
  status: string;
  total: number;
  importados: number;
  repetidos: number;
  invalidos: number;
  quem: string | null;
  quando: string;
}

const EXPLICACAO: Record<Situacao, { texto: string; classe: string }> = {
  novo: { texto: 'entra', classe: 'pilula ok' },
  ja_existe: { texto: 'já está no sistema', classe: 'pilula' },
  repetido_no_arquivo: { texto: 'repetido na planilha', classe: 'pilula' },
  sem_telefone: { texto: 'sem telefone', classe: 'pilula atencao' },
  telefone_invalido: { texto: 'telefone inválido', classe: 'pilula perigo' },
};

const NOME_DA_COLUNA: Record<string, string> = {
  nome: 'Nome',
  telefone: 'Telefone',
  cidade: 'Cidade',
  estado: 'Estado',
  email: 'E-mail',
  observacao: 'Observação',
};

export default function ImportarPage() {
  const lotes = usarApi<{ itens: Lote[] }>('/import');
  const arquivo = useRef<HTMLInputElement>(null);
  const [rotulo, setRotulo] = useState('');
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [filtro, setFiltro] = useState<Situacao | 'todas'>('todas');

  const enviar = async (rota: 'conferir' | 'confirmar'): Promise<void> => {
    const f = arquivo.current?.files?.[0];
    if (!f) {
      setRecado({ texto: 'Escolha a planilha primeiro.', tipo: 'erro' });
      return;
    }
    setOcupado(true);
    setRecado(null);

    const corpo = new FormData();
    corpo.append('file', f);
    if (rota === 'confirmar') corpo.append('rotulo', rotulo);

    try {
      const res = await fetch(`${BASE}/import/${rota}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
        body: corpo,
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(json.message ?? 'A planilha não foi aceita.'));

      if (rota === 'conferir') {
        setConferencia(json as unknown as Conferencia);
      } else {
        const r = json as { importados: number; ignorados: Record<string, number> };
        setConferencia(null);
        setRotulo('');
        if (arquivo.current) arquivo.current.value = '';
        setRecado({
          texto: `${r.importados} lead(s) entraram no funil, na etapa Nutrição. Já dá para vê-los na tela de Leads.`,
          tipo: 'ok',
        });
        lotes.recarregar();
      }
    } catch (e) {
      setRecado({ texto: e instanceof Error ? e.message : 'Não deu para ler a planilha.', tipo: 'erro' });
    } finally {
      setOcupado(false);
    }
  };

  const linhasVisiveis = conferencia
    ? conferencia.linhas.filter((l) => filtro === 'todas' || l.situacao === filtro)
    : [];

  return (
    <Shell>
      <h1>Trazer leads de planilha</h1>
      <p className="sub">
        Para colocar no sistema quem já demonstrou interesse antes. O sistema confere telefone por telefone
        e não deixa entrar ninguém que já está aqui.
      </p>

      {recado ? <Aviso texto={recado.texto} tipo={recado.tipo} /> : null}

      <section className="painel" style={{ marginBottom: 18 }}>
        <h2>1. Escolha a planilha</h2>
        <div className="filtros" style={{ marginBottom: 6 }}>
          <div className="campo">
            <label htmlFor="arq">Arquivo .xlsx ou .csv</label>
            <input id="arq" type="file" ref={arquivo} accept=".xlsx,.xlsm,.csv,.txt" />
          </div>
          <div className="campo">
            <label htmlFor="rotulo">Nome do lote</label>
            <input
              id="rotulo"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Base 2024"
              style={{ minWidth: 220 }}
            />
          </div>
          <button className="btn secundario" type="button" disabled={ocupado} onClick={() => void enviar('conferir')}>
            {ocupado ? 'Lendo…' : 'Conferir antes de importar'}
          </button>
        </div>
        <p className="sub" style={{ margin: 0 }}>
          A planilha precisa ter uma coluna de telefone — pode se chamar <strong>telefone</strong>,{' '}
          <strong>celular</strong> ou <strong>whatsapp</strong>. Nome, cidade, e-mail e observação entram se existirem.
          O nome do lote vira a origem desses leads nos relatórios.
        </p>
      </section>

      {conferencia ? (
        <section className="painel" style={{ marginBottom: 18 }}>
          <h2>2. Confira o que vai acontecer</h2>

          <div className="destaques" style={{ marginBottom: 16 }}>
            <div className="item"><b>{numero(conferencia.totalDeLinhas)}</b><span>linhas na planilha</span></div>
            <div className="item"><b>{numero(conferencia.resumo.novo)}</b><span>entram</span></div>
            <div className="item"><b>{numero(conferencia.resumo.ja_existe)}</b><span>já no sistema</span></div>
            <div className="item"><b>{numero(conferencia.resumo.repetido_no_arquivo)}</b><span>repetidos na planilha</span></div>
            <div className="item">
              <b>{numero(conferencia.resumo.sem_telefone + conferencia.resumo.telefone_invalido)}</b>
              <span>sem telefone válido</span>
            </div>
          </div>

          <p className="sub">
            Colunas reconhecidas:{' '}
            {Object.entries(conferencia.colunasEncontradas)
              .map(([campo, coluna]) => `${NOME_DA_COLUNA[campo] ?? campo}: ${coluna ?? '— não achei'}`)
              .join(' · ')}
          </p>

          <div className="filtros">
            <div className="campo">
              <label htmlFor="filtro">Mostrar</label>
              <select id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value as Situacao | 'todas')}>
                <option value="todas">Todas as linhas</option>
                <option value="novo">Só as que entram</option>
                <option value="ja_existe">Já no sistema</option>
                <option value="repetido_no_arquivo">Repetidas na planilha</option>
                <option value="telefone_invalido">Telefone inválido</option>
                <option value="sem_telefone">Sem telefone</option>
              </select>
            </div>
          </div>

          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th className="num">Linha</th><th>Nome</th><th>Telefone na planilha</th>
                  <th>Como vai ficar</th><th>Cidade</th><th>O que acontece</th>
                </tr>
              </thead>
              <tbody>
                {linhasVisiveis.slice(0, 200).map((l) => (
                  <tr key={l.linha}>
                    <td className="num linha-fraca">{l.linha}</td>
                    <td className="linha-forte">{l.nome ?? '—'}</td>
                    <td className="linha-fraca">{l.telefoneOriginal ?? '—'}</td>
                    <td>{l.telefone ?? '—'}</td>
                    <td>{l.cidade ?? '—'}</td>
                    <td><span className={EXPLICACAO[l.situacao].classe}>{EXPLICACAO[l.situacao].texto}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {linhasVisiveis.length > 200 ? (
            <p className="sub" style={{ marginTop: 12 }}>
              Mostrando as 200 primeiras de {numero(linhasVisiveis.length)}. A importação leva todas.
            </p>
          ) : null}

          <div className="linha-botoes">
            <button
              className="btn"
              type="button"
              disabled={ocupado || conferencia.resumo.novo === 0 || rotulo.trim().length < 3}
              onClick={() => void enviar('confirmar')}
            >
              {ocupado ? 'Importando…' : `Importar ${numero(conferencia.resumo.novo)} lead(s)`}
            </button>
            <button className="btn secundario" type="button" onClick={() => setConferencia(null)}>
              Cancelar
            </button>
          </div>
          {rotulo.trim().length < 3 ? (
            <p className="sub" style={{ margin: '8px 0 0' }}>Dê um nome ao lote antes de importar.</p>
          ) : null}
          {conferencia.resumo.novo === 0 ? (
            <p className="sub" style={{ margin: '8px 0 0' }}>
              Nenhuma linha nova: todos os telefones desta planilha já estão no sistema ou não são válidos.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="painel">
        <h2>Planilhas já importadas</h2>
        {lotes.carregando ? <Carregando o="o histórico" /> : null}
        {lotes.erro ? <Erro mensagem={lotes.erro} /> : null}
        {lotes.dados && lotes.dados.itens.length === 0 ? (
          <Vazio titulo="Nenhuma planilha ainda" texto="Quando você importar, o histórico aparece aqui." />
        ) : null}
        {lotes.dados && lotes.dados.itens.length > 0 ? (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Lote</th><th>Arquivo</th><th className="num">Entraram</th>
                  <th className="num">Ignorados</th><th>Quem</th><th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {lotes.dados.itens.map((l) => (
                  <tr key={l.id}>
                    <td className="linha-forte">{l.rotulo}</td>
                    <td className="linha-fraca">{l.arquivo}</td>
                    <td className="num">{numero(l.importados)}</td>
                    <td className="num linha-fraca">{numero(l.repetidos + l.invalidos)}</td>
                    <td>{l.quem ?? '—'}</td>
                    <td className="linha-fraca">{dataHora(l.quando)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
