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
      <aside className="lado">
        <div className="marca" style={{ border: 0, padding: 0 }}>
          <span className="cone" aria-hidden="true">J</span>
          <span>
            <b>Jolô Gelato</b>
            <small>Franquias</small>
          </span>
        </div>
        <div>
          <h2>Cada candidato a franqueado, do primeiro “oi” ao contrato.</h2>
          <p>
            Conversas do WhatsApp, funil de expansão, prazo da COF e documentos — tudo no mesmo lugar,
            com registro de quem fez o quê.
          </p>
        </div>
        <p className="assinatura">Acesso restrito ao time de expansão</p>
      </aside>

      <div className="entrada">
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
              .catch((e2: Error) => setErro(e2.message))
              .finally(() => setEnviando(false));
          }}
        >
          <div>
            <h1>Entrar no CRM</h1>
            <p className="sub">Use o e-mail cadastrado pelo administrador.</p>
          </div>

          {erro ? <div className="erro">{erro}</div> : null}

          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="voce@jologelato.com.br"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          <button className="btn" type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="rodape">
            Esqueceu a senha? Peça a um administrador para gerar uma nova.
          </p>
        </form>
      </div>
    </div>
  );
}
