import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, RateLimit, SemTermo, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { AuthService } from './auth.service.js';
import { TermoService } from '../termo/termo.service.js';

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

const definirSenhaSchema = z.object({
  token: z.string().min(20).max(200),
  senha: z.string().min(12).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly termo: TermoService,
  ) {}

  @Public()
  @RateLimit('login')
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() req: { ip?: string; headers: Record<string, string> },
  ) {
    return this.auth.login({
      email: body.email,
      password: body.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** Quem recebeu um link de acesso cria a propria senha aqui. */
  @Public()
  @RateLimit('login')
  @HttpCode(200)
  @Post('definir-senha')
  async definirSenha(@Body(new ZodValidationPipe(definirSenhaSchema)) body: z.infer<typeof definirSenhaSchema>) {
    await this.auth.definirSenhaPorLink(body.token, body.senha);
    return { ok: true, mensagem: 'Senha criada. Entre com o seu e-mail e a senha nova.' };
  }

  @SemTermo()
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    // a tela sabe, logo ao entrar, se precisa mostrar o termo antes de tudo
    return { user, termoPendente: !(await this.termo.aceitou(user.id)) };
  }

  @SemTermo()
  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logout(user);
    return { ok: true };
  }

  @SemTermo()
  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.auth.logoutAll(user);
    return { ok: true, sessoesEncerradas: count };
  }

  @SemTermo()
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
  ) {
    await this.auth.changeOwnPassword(user, body.currentPassword, body.newPassword);
    return { ok: true, mensagem: 'Senha alterada. Entre novamente.' };
  }
}
