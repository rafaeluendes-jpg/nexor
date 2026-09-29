'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

/**
 * Link de acesso de uso unico: a pessoa cria a propria senha aqui. O codigo
 * do link vem depois do "#", que o navegador nunca manda para servidor
 * nenhum - so esta tela le e envia uma unica vez.
 */
export default function DefinirSenhaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get('t');
    setToken(t);
    // tira o codigo da barra de endereco: nao fica no historico nem em print
    if (t) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const curta = senha.length > 0 && senha.length < 8;
  const diferente = confirma.length > 0 && confirma !== senha;

  return (
    <div className="login termo">
      <div className="entrada">
        {pronto ? (
          <div className="cartao-login">
            <h1>Senha criada</h1>
            <p className="sub">Agora é só entrar com o seu e-mail e a senha que você acabou de criar.</p>
            <a className="btn" href="/login">Entrar no CRM</a>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!token || curta || diferente || !senha) return;
              setErro(null);
              setEnviando(true);
              api('/auth/definir-senha', { method: 'POST', body: JSON.stringify({ token, senha }) })
                .then(() => setPronto(true))
                .catch((e2: Error) => setErro(e2.message))
                .finally(() => setEnviando(false));
            }}
          >
            <div>
              <h1>Crie a sua senha</h1>
              <p className="sub">Este link funciona uma vez só. Ninguém mais fica sabendo a senha que você criar.</p>
            </div>

            {token === null ? null : !token ? (
              <div className="erro">Este link está incompleto. Peça um link de acesso novo ao administrador.</div>
            ) : null}
            {erro ? <div className="erro">{erro}</div> : null}

            <div className="campo">
              <label htmlFor="senha">Senha nova</label>
              <input
                id="senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <small className={curta ? 'dica-erro' : 'dica'}>
                Pelo menos 8 caracteres, com letras e números. Não vale palavra óbvia ("senha", "jolo", "gelato") nem sequência como 12345678.
              </small>
            </div>

            <div className="campo">
              <label htmlFor="confirma">Repita a senha</label>
              <input
                id="confirma"
                type="password"
                autoComplete="new-password"
                required
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
              />
              {diferente ? <small className="dica-erro">As duas senhas não estão iguais.</small> : null}
            </div>

            <button className="btn" type="submit" disabled={!token || enviando || curta || diferente || !senha || !confirma}>
              {enviando ? 'Criando…' : 'Criar senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
