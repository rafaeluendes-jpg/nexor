'use client';

import { useEffect, useState } from 'react';
import { estadoDosAvisos, ligarAvisos, type EstadoDosAvisos } from '../lib/avisosCelular';

const EXPLICACAO: Partial<Record<EstadoDosAvisos, string>> = {
  'instalar-no-iphone':
    'No iPhone: toque em Compartilhar e em "Adicionar à Tela de Início". Abra o CRM pelo ícone e ligue os avisos.',
  bloqueado: 'Os avisos estão bloqueados neste aparelho. Libere nas configurações do navegador, em Notificações.',
  'sem-suporte': 'Este navegador não recebe avisos. No celular, use o Chrome (Android) ou o Safari (iPhone).',
};

/** Faixa no topo das Conversas: liga o aviso de mensagem nova neste aparelho. */
export function AvisosCelular() {
  const [estado, setEstado] = useState<EstadoDosAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    estadoDosAvisos().then(setEstado).catch(() => setEstado('sem-suporte'));
  }, []);

  if (!estado || estado === 'ligado') return null;

  if (estado !== 'desligado') {
    return <div className="aviso avisos-celular">{EXPLICACAO[estado]}</div>;
  }

  return (
    <div className="aviso avisos-celular">
      <span>Receba um aviso neste aparelho a cada mensagem nova, como no WhatsApp.</span>
      <button
        type="button"
        className="btn"
        disabled={ocupado}
        onClick={() => {
          setOcupado(true);
          setErro(null);
          ligarAvisos()
            .then(setEstado)
            .catch((e: Error) => setErro(e.message))
            .finally(() => setOcupado(false));
        }}
      >
        {ocupado ? 'Ligando…' : 'Ligar avisos'}
      </button>
      {erro ? <small className="erro-texto">{erro}</small> : null}
    </div>
  );
}
