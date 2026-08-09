import * as fs from 'fs';
import * as path from 'path';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { UsersAdminController } from '../admin/users-admin.controller';
import { UnitsAdminController } from '../admin/units-admin.controller';
import { EvidenceController } from '../evidence/evidence.controller';

// T037 (FR-067): desativacao preserva autoria e historico; exclusao fisica
// nunca e uma rota possivel. Duas checagens independentes por entidade —
// nenhuma rota HTTP e um metodo DELETE (via metadados reais do Nest, nao
// grep de texto), e nenhum service por tras dela chama
// prisma.<model>.delete/deleteMany contra o modelo de negocio em si
// (deleteMany em tabela de associacao, como userUnitAccess, e revogacao de
// acesso, nao exclusao de entidade — fora do escopo desta garantia).
function hasDeleteRoute(controller: new (...args: never[]) => unknown): boolean {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .some((name) => Reflect.getMetadata(METHOD_METADATA, prototype[name] as object) === RequestMethod.DELETE);
}

function readServiceSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf-8');
}

describe('nenhuma rota exclui fisicamente usuario, unidade ou evidencia (FR-067)', () => {
  test('UsersAdminController nao expoe rota DELETE', () => {
    expect(hasDeleteRoute(UsersAdminController)).toBe(false);
  });

  test('UnitsAdminController nao expoe rota DELETE', () => {
    expect(hasDeleteRoute(UnitsAdminController)).toBe(false);
  });

  test('EvidenceController nao expoe rota DELETE', () => {
    expect(hasDeleteRoute(EvidenceController)).toBe(false);
  });

  test('users-admin.service.ts nunca chama prisma.user.delete/deleteMany', () => {
    const source = readServiceSource('admin/users-admin.service.ts');
    expect(source).not.toMatch(/\.user\.delete(Many)?\(/);
  });

  test('units-admin.service.ts nunca chama prisma.unit.delete/deleteMany', () => {
    const source = readServiceSource('admin/units-admin.service.ts');
    expect(source).not.toMatch(/\.unit\.delete(Many)?\(/);
  });

  test('evidence.service.ts nunca chama prisma.evidenceFile.delete/deleteMany', () => {
    const source = readServiceSource('evidence/evidence.service.ts');
    expect(source).not.toMatch(/\.evidenceFile\.delete(Many)?\(/);
  });
});
