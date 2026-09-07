'use client';

/** Estados de tela repetidos em todo lugar: carregando, erro e lista vazia. */
export function Carregando({ o = 'os dados' }: { o?: string }) {
  return <div className="vazio">Carregando {o}…</div>;
}

export function Erro({ mensagem }: { mensagem: string }) {
  return <div className="aviso erro">{mensagem}</div>;
}

export function Vazio({ texto, titulo }: { texto: string; titulo?: string }) {
  return (
    <div className="vazio">
      {titulo ? <strong>{titulo}</strong> : null}
      {texto}
    </div>
  );
}

export function Aviso({ texto, tipo = 'aviso' }: { texto: string; tipo?: 'aviso' | 'erro' | 'ok' }) {
  return <div className={tipo === 'aviso' ? 'aviso' : `aviso ${tipo}`}>{texto}</div>;
}
