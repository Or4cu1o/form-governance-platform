import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

// FR-124: toda mensagem de erro exposta ao cliente MUST estar em portugues
// do Brasil. As classes de excecao do Nest (NotFoundException etc.) ja sao
// lancadas com `message` em pt-BR em todo o codigo, mas o campo `error`
// default e a frase-motivo em ingles ("Not Found", "Bad Request"...) — este
// filtro normaliza esse campo. Excecao nao tratada (ex.: erro do Prisma, que
// pode citar nome de tabela/coluna na mensagem) nunca repassa `exception`
// para o cliente: so o log do servidor recebe o detalhe interno.
interface ErrorEnvelope {
  statusCode: number;
  message: string | string[];
  error: string;
}

const REASON_PT_BR: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Requisicao invalida',
  [HttpStatus.UNAUTHORIZED]: 'Nao autenticado',
  [HttpStatus.FORBIDDEN]: 'Acesso negado',
  [HttpStatus.NOT_FOUND]: 'Recurso nao encontrado',
  [HttpStatus.CONFLICT]: 'Conflito',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Entidade nao processavel',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Muitas requisicoes',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Erro interno do servidor',
};

const DEFAULT_ENGLISH_REASONS = new Set([
  'Bad Request',
  'Unauthorized',
  'Forbidden',
  'Not Found',
  'Conflict',
  'Unprocessable Entity',
  'Too Many Requests',
  'Internal Server Error',
]);

function reasonFor(status: number): string {
  return REASON_PT_BR[status] ?? 'Erro';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(this.envelopeFor(status, exception.getResponse()));
      return;
    }

    this.logger.error(
      'Excecao nao tratada',
      exception instanceof Error ? exception.stack : String(exception),
    );
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).json({
      statusCode: status,
      message: 'Ocorreu um erro interno. Tente novamente ou contate o suporte.',
      error: reasonFor(status),
    } satisfies ErrorEnvelope);
  }

  private envelopeFor(status: number, body: string | object): ErrorEnvelope {
    if (typeof body === 'string') {
      return { statusCode: status, message: body, error: reasonFor(status) };
    }
    const { message, error } = body as { message?: string | string[]; error?: string };
    const preservedError = error && !DEFAULT_ENGLISH_REASONS.has(error) ? error : reasonFor(status);
    return {
      statusCode: status,
      message: message ?? reasonFor(status),
      error: preservedError,
    };
  }
}
