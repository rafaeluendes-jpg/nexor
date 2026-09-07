'use client';

import { useState } from 'react';
import { WHATSAPP, openFranchiseWhatsApp } from '../lib/whatsapp';

interface Props {
  origem: string;
  className: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

/** Botao unico do "Fale com o dono". Mesma funcao central em todos os lugares. */
export function WhatsAppButton({ origem, className, children, ariaLabel }: Props) {
  const [ocupado, setOcupado] = useState(false);

  return (
    <a
      className={className}
      href={WHATSAPP.configured ? '#contato' : '#contato'}
      aria-label={ariaLabel}
      aria-busy={ocupado}
      onClick={(e) => {
        e.preventDefault();
        if (ocupado) return;
        setOcupado(true);
        void openFranchiseWhatsApp(origem).finally(() => setOcupado(false));
      }}
    >
      {children}
    </a>
  );
}
