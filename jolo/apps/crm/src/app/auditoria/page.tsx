'use client';

import { useMemo, useState } from 'react';
import { Shell } from '../../components/Shell';
import { Carregando, Erro, Vazio } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { dataHora, numero } from '../../lib/formato';

interface Linha {
  id: string;
  quando: string;
  evento: string;
  entidade: string;
  entidadeId: string | null;
  quem: { id: string | null; nome: string };
  origem: string;
  antes: unknown;
  depois: unknown;
  ip: string | null;
}

export default function AuditoriaPage() {
  const [evento, setEvento] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);

  const caminho = useMemo(() => {
    const p = new URLSearchParams();
    if (evento) p.set('evento', evento);
    if (de) p.set('de', de);
    if (ate) p.set('ate', ate);
    p.set('take', '200');
    return `/audit?${p.toString()}`;
  }, [evento, de, ate]);

  const { dados, carregando, erro } = usarApi<{ total: number; itens: Linha[] }>(caminho);

  return (
    <Shell>
      <h1>Auditoria</h1>
      <p className="sub">
        Tudo que mudou dado no sistema, com quem fez e quando. Esta lista so se le: nao se edita nem se apaga.
      </p>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="ev">Tipo de acao</label>
          <input id="ev" value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="lead, cof, user…" />
        </div>
        <div className="campo">
          <label htmlFor="de">De</label>
          <input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="ate">Ate</label>
          <input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      {carregando ? <Carregando o="o registro" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}
      {dados && dados.itens.length === 0 ? <Vazio texto="Nenhum registro com esses filtros." /> : null}

      {dados && dados.itens.length > 0 ? (
        <div className="painel">
          <p className="sub" style={{ margin: '0 0 12px' }}>{numero(dados.total)} registro(s).</p>
          <table>
            <thead>
              <tr><th>Quando</th><th>Quem</th><th>Acao</th><th>Sobre</th><th>Origem</th><th /></tr>
            </thead>
            <tbody>
              {dados.itens.map((l) => (
                <tr key={l.id}>
                  <td>{dataHora(l.quando)}</td>
                  <td>{l.quem.nome}</td>
                  <td><code>{l.evento}</code></td>
                  <td>{l.entidade}</td>
                  <td>{l.origem}</td>
                  <td className="acoes">
                    {l.antes || l.depois ? (
                      <button type="button" onClick={() => setAberta(aberta === l.id ? null : l.id)}>
                        {aberta === l.id ? 'Fechar' : 'Ver detalhe'}
                      </button>
                    ) : null}
                    {aberta === l.id ? (
                      <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxWidth: 420 }}>
                        {JSON.stringify({ antes: l.antes, depois: l.depois }, null, 2)}
                      </pre>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Shell>
  );
}
