import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Termos de Uso | Jolô Gelato Franquias',
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Jolô Gelato Franquias</div>
        <h1 className="display" style={{ fontSize: '2.6rem', marginBottom: 24 }}>
          Termos de Uso
        </h1>
        <p>
          As informações desta página têm caráter informativo sobre o modelo de franquia da Jolô Gelato. Valores,
          prazos e condições apresentados são estimativas e podem variar conforme ponto, projeto e formato da unidade.
        </p>
        <p>
          Nenhuma informação desta página constitui oferta de franquia. A oferta formal ocorre por meio da Circular de
          Oferta de Franquia (COF), entregue durante o processo de avaliação, conforme a legislação brasileira.
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
