export interface AuthIdentity {
  providerId: string;
  email: string;
}

export interface SignInResult {
  ok: boolean;
  identity?: AuthIdentity;
  reason?: 'invalid_credentials' | 'provider_unavailable';
}

/**
 * Porta de autenticacao. Em producao a implementacao e o Supabase Auth:
 * a senha vive la, com hash, MFA e recuperacao proprios.
 */
export interface AuthProvider {
  readonly name: string;
  signIn(email: string, password: string): Promise<SignInResult>;
  createUser(email: string, password: string): Promise<AuthIdentity>;
  requestPasswordReset(email: string): Promise<void>;
  changePassword(providerId: string, newPassword: string): Promise<void>;
}
