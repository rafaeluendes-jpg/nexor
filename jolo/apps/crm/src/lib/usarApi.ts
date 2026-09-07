'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';

interface Estado<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Busca dados da API e devolve os tres estados que toda tela precisa.
 * Sem isto, cada tela reinventa carregando/erro/vazio de um jeito diferente.
 */
export function usarApi<T>(caminho: string | null, dependencias: unknown[] = []): Estado<T> {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gatilho, setGatilho] = useState(0);

  const recarregar = useCallback(() => setGatilho((n) => n + 1), []);

  useEffect(() => {
    if (!caminho) {
      setCarregando(false);
      return;
    }
    let vivo = true;
    setCarregando(true);
    setErro(null);
    api<T>(caminho)
      .then((r) => {
        if (vivo) setDados(r);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        // 403 nao e falha: e permissao. A tela precisa dizer isso com clareza.
        const msg =
          e instanceof ApiError && e.status === 403
            ? 'Voce nao tem permissao para ver esta area.'
            : e instanceof Error
              ? e.message
              : 'Nao foi possivel carregar.';
        setErro(msg);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho, gatilho, ...dependencias]);

  return { dados, carregando, erro, recarregar };
}
