import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Jolô Gelato Franquias',
  robots: { index: true, follow: true },
};

/**
 * Exigencia do item 54. Texto base para revisao juridica antes da publicacao.
 */
export default function Page() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Jolô Gelato Franquias</div>
        <h1 className="display" style={{ fontSize: '2.6rem', marginBottom: 24 }}>
          Política de Privacidade
        </h1>
        <p>
          Esta página explica quais dados a Jolô Gelato Franquias coleta quando você visita o site de franquias e
          clica em “Fale com o dono”.
        </p>
        <h3>O que coletamos</h3>
        <p>
          Ao clicar no botão de contato, registramos a origem da visita (campanha, anúncio e termos de busca, quando
          existirem), a página de entrada, a data e a hora do clique. Quando você inicia a conversa no WhatsApp,
          registramos seu nome de perfil, telefone e o conteúdo das mensagens trocadas com nossa equipe.
        </p>
        <h3>Para que usamos</h3>
        <p>
          Usamos esses dados para responder ao seu contato, entender de onde vêm os interessados na franquia e
          conduzir o processo de avaliação de novos franqueados.
        </p>
        <h3>Com quem compartilhamos</h3>
        <p>
          Os dados ficam com a Jolô Gelato Franquias e com os prestadores de serviço necessários para operar o
          atendimento, como a plataforma oficial do WhatsApp e nossos serviços de hospedagem e banco de dados.
        </p>
        <h3>Seus direitos</h3>
        <p>
          Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo mesmo WhatsApp do
          atendimento ou pelo e-mail de contato da franqueadora.
        </p>
        <p style={{ marginTop: 32 }}>
          <a className="btn btn-primary" href="/">
            Voltar para a página
          </a>
        </p>
      </div>
    </main>
  );
}
