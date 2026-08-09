export class ApiError extends Error {
  readonly status: number;
  // FR-129: o 409 de conflito de versao carrega um campo "current" alem da
  // mensagem — precisa sobreviver ate a UI que monta o dialogo de conflito.
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
