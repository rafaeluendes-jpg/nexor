'use client';

import { Shell } from '../../components/Shell';
import { Aviso, Carregando, Erro } from '../../components/Estado';
import { usarApi } from '../../lib/usarApi';
import { dataHora, numero } from '../../lib/formato';

interface Status {
  whatsapp: {
    configurado: boolean;
    credenciais: Record<string, boolean>;
    versaoDaApi: string;
    ultimoEventoRecebido: string | null;
    eventosRecusados24h: number;
    mensagens24h: number;
    pendencia: string | null;
  };
  ia: { configurada: boolean; provedor: string; modelo: string; pendencia: string | null };
  autenticacao: { provedor: string; supabaseConfigurado: boolean; pendencia: string | null };
  armazenamento: { provedor: string };
}

const NOMES: Record<string, string> = {
  appId: 'Identificação do app (App ID)',
  appSecret: 'Segredo do app (App Secret)',
  token: 'Token de envio',
  numeroId: 'Identificacao do número',
  contaComercialId: 'Conta comercial (WABA)',
  tokenDoWebhook: 'Token de verificação do webhook',
};

function Sinal({ ligado }: { ligado: boolean }) {
  return <span className={ligado ? 'pilula ok' : 'pilula perigo'}>{ligado ? 'configurado' : 'falta'}</span>;
}

export default function IntegracaoPage() {
  const { dados, carregando, erro } = usarApi<Status>('/integrations');

  return (
    <Shell>
      <h1>Integração WhatsApp</h1>
      <p className="sub">
        O sistema só fala pelo WhatsApp oficial da Meta. Esta tela mostra o que já está ligado —
        nunca o valor das credenciais.
      </p>

      {carregando ? <Carregando o="o estado da integração" /> : null}
      {erro ? <Erro mensagem={erro} /> : null}

      {dados ? (
        <>
          {dados.whatsapp.pendencia ? <Aviso texto={dados.whatsapp.pendencia} /> : null}

          <div className="cards">
            <div className="card">
              <b>{dados.whatsapp.configurado ? 'Sim' : 'Nao'}</b>
              <span>WhatsApp ligado</span>
            </div>
            <div className="card"><b>{numero(dados.whatsapp.mensagens24h)}</b><span>Mensagens em 24h</span></div>
            <div className="card"><b>{numero(dados.whatsapp.eventosRecusados24h)}</b><span>Eventos recusados em 24h</span></div>
            <div className="card"><b>{dados.whatsapp.versaoDaApi}</b><span>Versão da API da Meta</span></div>
          </div>

          <section className="painel" style={{ marginBottom: 16 }}>
            <h2>Credenciais</h2>
            <p className="sub">
              O sistema mostra apenas se cada credencial existe. O valor fica no servidor e nunca aparece em tela.
            </p>
            <table>
              <tbody>
                {Object.entries(dados.whatsapp.credenciais).map(([chave, ok]) => (
                  <tr key={chave}>
                    <td>{NOMES[chave] ?? chave}</td>
                    <td><Sinal ligado={ok} /></td>
                  </tr>
                ))}
                <tr>
                  <td>Último evento recebido da Meta</td>
                  <td>{dataHora(dados.whatsapp.ultimoEventoRecebido)}</td>
                </tr>
              </tbody>
            </table>
            {dados.whatsapp.eventosRecusados24h > 0 ? (
              <Aviso texto="Ha eventos recusados por assinatura. Quase sempre e o segredo do app trocado no painel da Meta." />
            ) : null}
          </section>

          <div className="duas-colunas">
            <section className="painel">
              <h2>IA de atendimento</h2>
              <table>
                <tbody>
                  <tr><td>Situação</td><td><Sinal ligado={dados.ia.configurada} /></td></tr>
                  <tr><td>Provedor</td><td>{dados.ia.provedor}</td></tr>
                  <tr><td>Modelo</td><td>{dados.ia.modelo}</td></tr>
                </tbody>
              </table>
              {dados.ia.pendencia ? <Aviso texto={dados.ia.pendencia} /> : null}
            </section>

            <section className="painel">
              <h2>Entrada no sistema</h2>
              <table>
                <tbody>
                  <tr><td>Provedor</td><td>{dados.autenticacao.provedor}</td></tr>
                  <tr><td>Supabase</td><td><Sinal ligado={dados.autenticacao.supabaseConfigurado} /></td></tr>
                  <tr><td>Armazenamento</td><td>{dados.armazenamento.provedor}</td></tr>
                </tbody>
              </table>
              {dados.autenticacao.pendencia ? <Aviso texto={dados.autenticacao.pendencia} /> : null}
            </section>
          </div>

          <section className="painel" style={{ marginTop: 16 }}>
            <h2>Como ligar</h2>
            <p className="sub">
              Todas essas credenciais saem do painel da Meta e do Supabase, e quem as cria e o dono da conta.
              O passo a passo, com o lugar exato de cada valor, está no arquivo <code>docs/WHATSAPP_SETUP.md</code>.
            </p>
          </section>
        </>
      ) : null}
    </Shell>
  );
}
