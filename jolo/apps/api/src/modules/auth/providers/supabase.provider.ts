import type { AuthIdentity, AuthProvider, SignInResult } from './types.js';

/**
 * Producao: toda a senha e responsabilidade do Supabase Auth.
 * O CRM nunca guarda, nunca compara e nunca exibe hash de senha.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = 'supabase';

  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
    private readonly anonKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async signIn(email: string, password: string): Promise<SignInResult> {
    const res = await this.fetchImpl(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: this.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 400 || res.status === 401) return { ok: false, reason: 'invalid_credentials' };
    if (!res.ok) return { ok: false, reason: 'provider_unavailable' };
    const json = (await res.json()) as { user?: { id: string; email: string } };
    if (!json.user) return { ok: false, reason: 'invalid_credentials' };
    return { ok: true, identity: { providerId: json.user.id, email: json.user.email } };
  }

  async createUser(email: string, password: string): Promise<AuthIdentity> {
    const res = await this.fetchImpl(`${this.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!res.ok) throw new Error(`Supabase recusou a criacao do usuario: HTTP ${res.status}`);
    const json = (await res.json()) as { id: string; email: string };
    return { providerId: json.id, email: json.email };
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.fetchImpl(`${this.url}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: this.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  }

  async changePassword(providerId: string, newPassword: string): Promise<void> {
    const res = await this.fetchImpl(`${this.url}/auth/v1/admin/users/${providerId}`, {
      method: 'PUT',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) throw new Error(`Supabase recusou a troca de senha: HTTP ${res.status}`);
  }
}
