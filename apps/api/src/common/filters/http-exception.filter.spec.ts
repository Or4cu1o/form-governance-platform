import { ArgumentsHost, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function buildHost(): { host: ArgumentsHost; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  test('traduz o campo "error" default do Nest para portugues em NotFoundException', () => {
    const { host, json, status } = buildHost();

    filter.catch(new NotFoundException('Unidade nao encontrada'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Unidade nao encontrada',
      error: 'Recurso nao encontrado',
    });
  });

  test('preserva a mensagem em array de uma falha de validacao (BadRequestException)', () => {
    const { host, json, status } = buildHost();

    filter.catch(new BadRequestException(['nome nao pode ser vazio', 'email invalido']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: ['nome nao pode ser vazio', 'email invalido'],
      error: 'Requisicao invalida',
    });
  });

  test('preserva um codigo de erro explicito que nao e a frase-motivo default do Nest', () => {
    const { host, json } = buildHost();

    filter.catch(
      new ConflictException({ statusCode: 409, error: 'CONFLITO_DE_VERSAO', message: 'Versao desatualizada' }),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Versao desatualizada',
      error: 'CONFLITO_DE_VERSAO',
    });
  });

  // FR-129: o 409 de conflito de versao carrega um campo "current" alem do
  // envelope padrao — precisa sobreviver a normalizacao de message/error.
  test('preserva campos extras do corpo da excecao (ex.: "current" do conflito de versao)', () => {
    const { host, json } = buildHost();
    const current = { versionId: 'version-2', variableValues: { CA: 5 }, authoredAt: '2026-08-10T00:00:00.000Z' };

    filter.catch(
      new ConflictException({ statusCode: 409, error: 'CONFLITO_DE_VERSAO', message: 'Versao desatualizada', current }),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Versao desatualizada',
      error: 'CONFLITO_DE_VERSAO',
      current,
    });
  });

  test('nunca expoe a mensagem de uma excecao nao tratada ao cliente', () => {
    const { host, json, status } = buildHost();

    filter.catch(new Error('relation "users" does not exist, column "senha_hash" violates constraint'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Ocorreu um erro interno. Tente novamente ou contate o suporte.',
      error: 'Erro interno do servidor',
    });
  });

  test('trata um valor lancado que nao e instancia de Error sem quebrar', () => {
    const { host, json, status } = buildHost();

    filter.catch('falha inesperada em string', host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'Erro interno do servidor' }),
    );
  });
});
