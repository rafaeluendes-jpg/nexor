'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearSession, getToken } from '../../lib/api';

interface Termo {
  versao: string;
  titulo: string;
  paragrafos: string[];
  aceitoEm: string | null;
}

/**
 * LGPD: antes de ver qualquer dado, cada usuario le e aceita o termo de uso
 * e confidencialidade. O aceite fica registrado com data, versao e origem.
 * A API recusa tudo ate la; esta tela e so o caminho para aceitar.
 */
export default function TermoPage() {
  const router = useRouter();
  const [termo, setTermo] = useState<Termo | null>(null);
  const [concordo, setConcordo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<Termo>('/termos/atual')
      .then((t) => (t.aceitoEm ? router.replace('/dashboard') : setTermo(t)))
      .catch((e: Error) => setErro(e.message));
  }, [router]);

  return (
    <div className="login termo">
      <div className="entrada">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!termo || !concordo) return;
            setErro(null);
            setEnviando(true);
            api('/termos/aceitar', { method: 'POST', body: JSON.stringify({ versao: termo.versao }) })
              .then(() => router.replace('/dashboard'))
              .catch((e2: Error) => setErro(e2.message))
              .finally(() => setEnviando(false));
          }}
        >
          <div>
            <h1>{termo?.titulo ?? 'Termo de uso e confidencialidade'}</h1>
            <p className="sub">Leia com atenção. Seu aceite fica registrado com data e hora.</p>
          </div>

          {erro ? <div className="erro">{erro}</div> : null}

          <div className="texto-termo" tabIndex={0} aria-label="Texto do termo">
            {termo ? termo.paragrafos.map((p) => <p key={p}>{p}</p>) : <p>Carregando o termo…</p>}
            {termo ? <p className="versao">Versão {termo.versao}</p> : null}
          </div>

          <label className="aceite">
            <input
              type="checkbox"
              checked={concordo}
              disabled={!termo}
              onChange={(e) => setConcordo(e.target.checked)}
            />
            <span>Li e aceito o termo de uso e confidencialidade.</span>
          </label>

          <button className="btn" type="submit" disabled={!termo || !concordo || enviando}>
            {enviando ? 'Registrando…' : 'Aceitar e entrar'}
          </button>

          <p className="rodape">
            Não concorda?{' '}
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                api('/auth/logout', { method: 'POST' }).catch(() => undefined);
                clearSession();
                router.replace('/login');
              }}
            >
              Sair sem aceitar
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
