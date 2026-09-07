'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken } from './api';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

/**
 * Escuta o canal de avisos da empresa (item 44) e chama de volta quando algo muda.
 *
 * Usa fetch com leitura em fluxo, e nao EventSource, porque EventSource nao
 * manda cabecalho: o token teria de ir na URL e acabaria em log de servidor.
 */
export function usarTempoReal(
  tipos: string[],
  aoMudar: () => void,
): { ligado: boolean } {
  const [ligado, setLigado] = useState(false);
  const callback = useRef(aoMudar);
  callback.current = aoMudar;

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const controle = new AbortController();
    let ativo = true;
    let tentativa = 0;

    const escutar = async (): Promise<void> => {
      while (ativo) {
        try {
          const res = await fetch(`${BASE}/realtime/stream`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controle.signal,
          });
          if (!res.ok || !res.body) throw new Error(`fluxo recusado (${res.status})`);

          setLigado(true);
          tentativa = 0;
          const leitor = res.body.getReader();
          const decodificador = new TextDecoder();
          let sobra = '';

          while (ativo) {
            const { done, value } = await leitor.read();
            if (done) break;
            sobra += decodificador.decode(value, { stream: true });

            // um aviso por bloco separado por linha em branco
            const blocos = sobra.split('\n\n');
            sobra = blocos.pop() ?? '';
            for (const bloco of blocos) {
              const evento = /^event:\s*(.+)$/m.exec(bloco)?.[1]?.trim();
              if (evento && tipos.includes(evento)) callback.current();
            }
          }
        } catch {
          if (!ativo) return;
        }
        setLigado(false);
        if (!ativo) return;
        // espera crescente: rede instavel nao vira martelada no servidor
        tentativa = Math.min(tentativa + 1, 5);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** tentativa));
      }
    };

    void escutar();
    return () => {
      ativo = false;
      controle.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos.join(',')]);

  return { ligado };
}
