'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveSession, type SessionUser } from '../../lib/api';

interface LoginResponse {
  accessToken: string;
  user: SessionUser;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="login">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErro(null);
          setEnviando(true);
          api<LoginResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password: senha }),
          })
            .then((r) => {
              saveSession(r.accessToken, r.user);
              router.replace('/dashboard');
            })
            .catch((e: Error) => setErro(e.message))
            .finally(() => setEnviando(false));
        }}
      >
        <h1>CRM Jolô</h1>
        <p className="sub" style={{ margin: 0 }}>
          Acesso restrito ao time de expansão.
        </p>
        {erro ? <div className="erro">{erro}</div> : null}
        <input
          type="email"
          placeholder="E-mail"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Senha"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <button className="btn" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
