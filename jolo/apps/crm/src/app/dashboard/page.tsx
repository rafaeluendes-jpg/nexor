'use client';

import { useEffect, useState } from 'react';
import { Shell } from '../../components/Shell';
import { api } from '../../lib/api';

interface Metrics {
  leads: { hoje: number; semana: number; mes: number; abertos: number; total: number };
  funil: { qualificados: number; reunioes: number; cofs: number; contratos: number; ganhos: number; perdidos: number };
  pendencias: { tarefasAbertas: number; proximasReunioes: number; cofsEmPrazo: number };
  taxaConversao: number;
  origens: { origem: string; leads: number }[];
}

export default function DashboardPage() {
  const [dados, setDados] = useState<Metrics | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Metrics>('/dashboard')
      .then(setDados)
      .catch((e: Error) => setErro(e.message));
  }, []);

  return (
    <Shell>
      <h1>Painel</h1>
      <p className="sub">Como está a expansão hoje.</p>
      {erro ? <div className="painel">{erro}</div> : null}
      {dados ? (
        <>
          <div className="cards">
            <div className="card">
              <b>{dados.leads.hoje}</b>
              <span>Leads hoje</span>
            </div>
            <div className="card">
              <b>{dados.leads.semana}</b>
              <span>Leads na semana</span>
            </div>
            <div className="card">
              <b>{dados.leads.mes}</b>
              <span>Leads no mês</span>
            </div>
            <div className="card">
              <b>{dados.leads.abertos}</b>
              <span>Em aberto</span>
            </div>
            <div className="card">
              <b>{dados.funil.qualificados}</b>
              <span>Qualificados</span>
            </div>
            <div className="card">
              <b>{dados.funil.reunioes}</b>
              <span>Reuniões</span>
            </div>
            <div className="card">
              <b>{dados.funil.cofs}</b>
              <span>COFs</span>
            </div>
            <div className="card">
              <b>{dados.funil.contratos}</b>
              <span>Contratos</span>
            </div>
            <div className="card">
              <b>{dados.funil.ganhos}</b>
              <span>Ganhos</span>
            </div>
            <div className="card">
              <b>{dados.taxaConversao}%</b>
              <span>Conversão</span>
            </div>
          </div>

          <div className="cards">
            <a className="card" href="/tarefas" style={{ textDecoration: 'none' }}>
              <b>{dados.pendencias.tarefasAbertas}</b>
              <span>Tarefas abertas</span>
            </a>
            <a className="card" href="/agenda" style={{ textDecoration: 'none' }}>
              <b>{dados.pendencias.proximasReunioes}</b>
              <span>Reuniões marcadas</span>
            </a>
            <a className="card" href="/cof" style={{ textDecoration: 'none' }}>
              <b>{dados.pendencias.cofsEmPrazo}</b>
              <span>COFs no prazo legal</span>
            </a>
          </div>
          <div className="painel">
            <h2>Origem dos leads</h2>
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Leads</th>
                </tr>
              </thead>
              <tbody>
                {dados.origens.length ? (
                  dados.origens.map((o) => (
                    <tr key={o.origem}>
                      <td>{o.origem}</td>
                      <td>{o.leads}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="vazio">
                      Ainda sem leads com origem registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </Shell>
  );
}
