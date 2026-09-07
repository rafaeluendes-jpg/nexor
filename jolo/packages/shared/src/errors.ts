export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Sem permissao para esta acao.') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Autenticacao necessaria.') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Registro nao encontrado.') {
    super(message, 'NOT_FOUND', 404);
  }
}
