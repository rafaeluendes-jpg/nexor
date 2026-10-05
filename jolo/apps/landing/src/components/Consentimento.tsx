'use client';

import { useEffect, useState } from 'react';
import { TEM_PIXEL, carregarPixels, gravarConsentimento, lerConsentimento } from '../lib/rastreio';

/**
 * Pergunta uma vez se o visitante aceita os pixels de anuncio (LGPD).
 * Sem pixel configurado, nao aparece. A resposta fica guardada no aparelho.
 */
export function Consentimento() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!TEM_PIXEL) return;
    const resposta = lerConsentimento();
    if (resposta === 'sim') carregarPixels();
    else if (resposta === null) setAberto(true);
  }, []);

  if (!aberto) return null;

  const responder = (v: 'sim' | 'nao') => {
    gravarConsentimento(v);
    setAberto(false);
  };

  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label="Aviso de cookies">
      <p>
        Usamos cookies para saber por qual anúncio ou rede você chegou até nós e melhorar nossa divulgação.{' '}
        <a href="/politica-de-privacidade">Política de privacidade</a>
      </p>
      <div className="consent-acoes">
        <button type="button" className="btn btn-primary" onClick={() => responder('sim')}>
          Aceitar
        </button>
        <button type="button" className="consent-nao" onClick={() => responder('nao')}>
          Agora não
        </button>
      </div>
    </div>
  );
}
