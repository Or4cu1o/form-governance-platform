# Integração LDAP por Unidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada `Unit` associe uma ou mais configurações LDAP (AD), autenticando usuários daquela unidade com suas credenciais de domínio, mapeando grupos do AD para Observador/Elaborador/Revisor automaticamente, e para Aprovador/Administrador via fila de aprovação manual.

**Architecture:** Novo módulo `apps/api/src/ldap/` concentra utilitários LDAP puros (parsing de identifier, escaping de filtro, sync de cargo), um client LDAP (`ldapts`), CRUD administrativo (configs + mapeamentos de grupo), a fila de elevação de cargo, e um serviço orquestrador (`LdapAuthService`) consumido pelo `AuthModule`. O restante do sistema (guards, `@Roles`, `AuthenticatedUser`) não muda — a integração só afeta como o usuário é autenticado/provisionado.

**Tech Stack:** NestJS 10, Prisma 5 (Postgres), `ldapts` (novo), `class-validator`, Jest.

## Global Constraints

- Backend apenas (`apps/api`) — nenhuma mudança em `apps/web` neste plano.
- Grupos do AD só aplicam cargo automaticamente para Observador/Elaborador/Revisor. Aprovador/Administrador **nunca** são setados automaticamente — sempre via `RoleElevationRequest` aprovada manualmente por um Administrador.
- Erros de autenticação LDAP são **sempre genéricos** ("Credenciais invalidas") no retorno da API — nunca diferenciar "usuário não existe" de "senha errada" na resposta HTTP.
- Senha de bind (`bindDn`/service account) é criptografada em repouso (AES-256-GCM) e nunca retornada por nenhum endpoint.
- Todo filtro LDAP construído com input externo passa por escaping RFC 4515.
- Commit ao final de cada task (conforme já pedido pelo usuário). Push somente ao final da última task.
- Cobertura de teste ≥ 80% nos arquivos novos, seguindo o estilo de teste já usado no projeto: mock manual do Prisma (`{ model: { method: jest.fn() } } as unknown as PrismaService`), instanciação direta do serviço/controller via `new Service(...)` (sem `Test.createTestingModule`).
- Spec de referência aprovado: `docs/superpowers/specs/2026-07-23-ldap-por-unidade-design.md`.
- **Baseline conhecido (pré-existente, não relacionado a LDAP):** `npx jest` no HEAD antes da Task 1 já falha em `src/lifecycle/report-lifecycle.service.spec.ts` e `src/users/users.service.spec.ts` (2 suites, 5 testes) — bugs antigos alheios a este plano (o `users.service.spec.ts` é corrigido de passagem na Task 12, já que essa task mexe exatamente no método afetado; `report-lifecycle.service.spec.ts` fica fora de escopo). Nenhum subagente deve tentar "consertar" `report-lifecycle.service.spec.ts` — é ruído de baseline, não uma regressão introduzida por esta feature.

---

## Task 1: Schema Prisma — modelos, enums e migrations

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration gerada por `prisma migrate dev --name add_ldap_integration`
- Create: `apps/api/prisma/migrations/<timestamp>_add_ldap_audit_triggers/migration.sql`

**Interfaces:**
- Produces: enums `AuthSource` (`LOCAL`, `LDAP`), `ElevationStatus` (`PENDING`, `APPROVED`, `REJECTED`, `REVOKED`); models `LdapConfig`, `LdapGroupMapping`, `RoleElevationRequest`; campos novos em `Unit` (`ldapEnabled`) e `User` (`authSource`, `ldapConfigId`, `ldapUsername`, `passwordHash` agora opcional). Todas as tasks seguintes dependem destes tipos gerados pelo Prisma Client (`@prisma/client`).

- [ ] **Step 1: Adicionar os enums `AuthSource` e `ElevationStatus`**

Em `apps/api/prisma/schema.prisma`, localizar o bloco:

```prisma
enum AuditAction {
  INSERT
  UPDATE

  @@map("audit_action")
}

// ---------------------------------------------------------------------------
// RBAC / Identidade e Unidades (Secao 3)
// ---------------------------------------------------------------------------
```

Substituir por:

```prisma
enum AuditAction {
  INSERT
  UPDATE

  @@map("audit_action")
}

enum AuthSource {
  LOCAL
  LDAP

  @@map("auth_source")
}

enum ElevationStatus {
  PENDING
  APPROVED
  REJECTED
  REVOKED

  @@map("elevation_status")
}

// ---------------------------------------------------------------------------
// RBAC / Identidade e Unidades (Secao 3)
// ---------------------------------------------------------------------------
```

- [ ] **Step 2: Adicionar `ldapEnabled` e a relação `ldapConfigs` em `Unit`**

Substituir:

```prisma
model Unit {
  id             String    @id @default(uuid())
  sigla          String    @unique
  nome           String
  logoUrl        String?   @map("logo_url")
  level          UnitLevel
  formTemplateId String?   @map("form_template_id")
  isActive       Boolean   @default(true) @map("is_active")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  formTemplate    FormTemplate?    @relation(fields: [formTemplateId], references: [id])
  primaryUsers    User[]           @relation("PrimaryUnit")
  unitAccesses    UserUnitAccess[]
  reportInstances ReportInstance[]

  @@map("units")
}
```

Por:

```prisma
model Unit {
  id             String    @id @default(uuid())
  sigla          String    @unique
  nome           String
  logoUrl        String?   @map("logo_url")
  level          UnitLevel
  formTemplateId String?   @map("form_template_id")
  isActive       Boolean   @default(true) @map("is_active")
  ldapEnabled    Boolean   @default(false) @map("ldap_enabled")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  formTemplate    FormTemplate?    @relation(fields: [formTemplateId], references: [id])
  primaryUsers    User[]           @relation("PrimaryUnit")
  unitAccesses    UserUnitAccess[]
  reportInstances ReportInstance[]
  ldapConfigs     LdapConfig[]

  @@map("units")
}
```

- [ ] **Step 3: Adicionar campos LDAP em `User`, tornar `passwordHash` opcional**

Substituir:

```prisma
model User {
  id            String   @id @default(uuid())
  matricula     String   @unique
  nome          String
  sobrenome     String
  email         String   @unique
  passwordHash  String   @map("password_hash")
  role          RoleName
  primaryUnitId String   @map("primary_unit_id")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  primaryUnit       Unit                @relation("PrimaryUnit", fields: [primaryUnitId], references: [id])
  unitAccesses      UserUnitAccess[]
  updatedResponses  IndicatorResponse[] @relation("ResponseUpdatedBy")
  uploadedEvidences EvidenceFile[]      @relation("EvidenceUploadedBy")
  validationRecords ValidationRecord[]  @relation("ValidationByAprovador")
  auditLogs         AuditLog[]          @relation("AuditActor")

  @@map("users")
}
```

Por:

```prisma
model User {
  id            String     @id @default(uuid())
  matricula     String     @unique
  nome          String
  sobrenome     String
  email         String     @unique
  passwordHash  String?    @map("password_hash")
  role          RoleName
  primaryUnitId String     @map("primary_unit_id")
  isActive      Boolean    @default(true) @map("is_active")
  authSource    AuthSource @default(LOCAL) @map("auth_source")
  ldapConfigId  String?    @map("ldap_config_id")
  ldapUsername  String?    @map("ldap_username")
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  primaryUnit        Unit                    @relation("PrimaryUnit", fields: [primaryUnitId], references: [id])
  ldapConfig         LdapConfig?             @relation(fields: [ldapConfigId], references: [id])
  unitAccesses       UserUnitAccess[]
  updatedResponses   IndicatorResponse[]     @relation("ResponseUpdatedBy")
  uploadedEvidences  EvidenceFile[]          @relation("EvidenceUploadedBy")
  validationRecords  ValidationRecord[]      @relation("ValidationByAprovador")
  auditLogs          AuditLog[]              @relation("AuditActor")
  elevationRequests  RoleElevationRequest[]  @relation("ElevationRequests")
  reviewedElevations RoleElevationRequest[]  @relation("ElevationReviewedBy")

  @@unique([ldapConfigId, ldapUsername])
  @@map("users")
}
```

- [ ] **Step 4: Adicionar os modelos `LdapConfig`, `LdapGroupMapping` e `RoleElevationRequest` ao final do arquivo**

Adicionar após o fechamento do `model AuditLog` (final do arquivo):

```prisma

// ---------------------------------------------------------------------------
// Integracao LDAP por Unidade (login via AD, mapeamento de grupo -> cargo)
// ---------------------------------------------------------------------------

model LdapConfig {
  id                    String   @id @default(uuid())
  unitId                String   @map("unit_id")
  name                  String
  domain                String   @unique
  hosts                 String[]
  port                  Int      @default(636)
  useTls                Boolean  @default(true) @map("use_tls")
  bindDn                String   @map("bind_dn")
  bindPasswordEncrypted String   @map("bind_password_encrypted")
  baseDn                String   @map("base_dn")
  isActive              Boolean  @default(true) @map("is_active")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  unit          Unit               @relation(fields: [unitId], references: [id])
  groupMappings LdapGroupMapping[]
  users         User[]

  @@index([unitId])
  @@map("ldap_configs")
}

model LdapGroupMapping {
  id           String   @id @default(uuid())
  ldapConfigId String   @map("ldap_config_id")
  groupDn      String   @map("group_dn")
  role         RoleName
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  ldapConfig LdapConfig @relation(fields: [ldapConfigId], references: [id])

  @@unique([ldapConfigId, groupDn, role])
  @@map("ldap_group_mappings")
}

model RoleElevationRequest {
  id            String          @id @default(uuid())
  userId        String          @map("user_id")
  requestedRole RoleName        @map("requested_role")
  status        ElevationStatus @default(PENDING)
  sourceGroupDn String          @map("source_group_dn")
  reviewedById  String?         @map("reviewed_by_id")
  reviewedAt    DateTime?       @map("reviewed_at")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  user       User  @relation("ElevationRequests", fields: [userId], references: [id])
  reviewedBy User? @relation("ElevationReviewedBy", fields: [reviewedById], references: [id])

  @@index([userId, status])
  @@map("role_elevation_requests")
}
```

- [ ] **Step 5: Gerar e aplicar a migration do schema**

Run (a partir de `apps/api`):
```bash
cd apps/api
npm run prisma:migrate:dev -- --name add_ldap_integration
```
Expected: migration criada em `prisma/migrations/<timestamp>_add_ldap_integration/`, aplicada sem erros, `npm run prisma:generate` executado automaticamente pelo Prisma.

- [ ] **Step 6: Criar a migration dos triggers de auditoria para as 3 tabelas novas**

Run:
```bash
npm run prisma:migrate:dev -- --create-only --name add_ldap_audit_triggers
```

Editar o arquivo gerado `apps/api/prisma/migrations/<timestamp>_add_ldap_audit_triggers/migration.sql` (fica vazio por padrão com `--create-only`) para conter:

```sql
-- Estende a trilha de auditoria (fn_write_audit_log, definida em
-- add_audit_trigger) para as tabelas da integracao LDAP por unidade.
CREATE TRIGGER trg_audit_ldap_configs
AFTER INSERT OR UPDATE ON ldap_configs
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_ldap_group_mappings
AFTER INSERT OR UPDATE ON ldap_group_mappings
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_role_elevation_requests
AFTER INSERT OR UPDATE ON role_elevation_requests
FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();
```

Run:
```bash
npm run prisma:migrate:dev
```
Expected: a migration `add_ldap_audit_triggers` é aplicada sem erros (o Prisma detecta que já está pendente).

- [ ] **Step 7: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(ldap): adiciona modelos e migrations da integracao LDAP por unidade"
```

---

## Task 2: Variável de ambiente `LDAP_CONFIG_ENCRYPTION_KEY`

**Files:**
- Modify: `apps/api/src/config/env.validation.ts`
- Modify: `apps/api/src/config/env.validation.spec.ts`

**Interfaces:**
- Produces: `LDAP_CONFIG_ENCRYPTION_KEY` passa a ser exigida na inicialização (validado por `validateEnv`). Consumida na Task 3 (`ldap-crypto.util.ts`) e Task 8 (`LdapConfigsService`).

- [ ] **Step 1: Atualizar o teste primeiro (RED)**

Editar `apps/api/src/config/env.validation.spec.ts`:

```typescript
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'secret',
    INITIAL_ADMIN_MATRICULA: '00001',
    INITIAL_ADMIN_EMAIL: 'admin@formops.local',
    INITIAL_ADMIN_PASSWORD: 'strong-password',
    LDAP_CONFIG_ENCRYPTION_KEY: 'ZmFrZS0zMi1ieXRlLWtleS1mb3ItdGVzdHMtb25seSE=',
  };

  test('returns the config unchanged when every required variable is present', () => {
    expect(validateEnv(validConfig)).toBe(validConfig);
  });

  test('throws when a single required variable is missing', () => {
    const { JWT_SECRET, ...withoutJwtSecret } = validConfig;

    expect(() => validateEnv(withoutJwtSecret)).toThrow('JWT_SECRET');
  });

  test('lists every missing variable in the error message', () => {
    expect(() => validateEnv({ DATABASE_URL: validConfig.DATABASE_URL })).toThrow(
      'JWT_SECRET, INITIAL_ADMIN_MATRICULA, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, LDAP_CONFIG_ENCRYPTION_KEY',
    );
  });

  test('treats an empty-string value as missing', () => {
    expect(() => validateEnv({ ...validConfig, JWT_SECRET: '' })).toThrow('JWT_SECRET');
  });

  test('throws when LDAP_CONFIG_ENCRYPTION_KEY is missing', () => {
    const { LDAP_CONFIG_ENCRYPTION_KEY, ...withoutKey } = validConfig;

    expect(() => validateEnv(withoutKey)).toThrow('LDAP_CONFIG_ENCRYPTION_KEY');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd apps/api && npx jest env.validation.spec.ts`
Expected: FAIL — a mensagem de erro não lista `LDAP_CONFIG_ENCRYPTION_KEY` ainda.

- [ ] **Step 3: Adicionar a variável obrigatória**

Editar `apps/api/src/config/env.validation.ts`:

```typescript
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'INITIAL_ADMIN_MATRICULA',
  'INITIAL_ADMIN_EMAIL',
  'INITIAL_ADMIN_PASSWORD',
  'LDAP_CONFIG_ENCRYPTION_KEY',
] as const;

// Falha rapido na inicializacao se algum segredo/config obrigatorio nao
// estiver presente, em vez de deixar o erro estourar no primeiro uso.
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Variaveis de ambiente obrigatorias ausentes: ${missing.join(', ')}`);
  }
  return config;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd apps/api && npx jest env.validation.spec.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/config/env.validation.ts apps/api/src/config/env.validation.spec.ts
git commit -m "feat(ldap): exige LDAP_CONFIG_ENCRYPTION_KEY na inicializacao"
```

**Nota para quem for rodar em ambiente real:** gerar a chave com `openssl rand -base64 32` e definir `LDAP_CONFIG_ENCRYPTION_KEY` no `.env` local antes de subir a API (a partir da Task 8 em diante, a ausência/formato inválido dessa chave impede a API de iniciar).

---

## Task 3: Utilitário de criptografia da senha de bind (`ldap-crypto.util.ts`)

**Files:**
- Create: `apps/api/src/ldap/ldap-crypto.util.ts`
- Test: `apps/api/src/ldap/ldap-crypto.util.spec.ts`

**Interfaces:**
- Produces: `parseLdapEncryptionKey(base64Key: string): Buffer`, `encryptLdapBindPassword(plainText: string, key: Buffer): string`, `decryptLdapBindPassword(payload: string, key: Buffer): string`. Consumidos pela Task 8 (`LdapConfigsService`).

- [ ] **Step 1: Escrever o teste (RED)**

Create `apps/api/src/ldap/ldap-crypto.util.spec.ts`:

```typescript
import { randomBytes } from 'crypto';
import { decryptLdapBindPassword, encryptLdapBindPassword, parseLdapEncryptionKey } from './ldap-crypto.util';

describe('ldap-crypto.util', () => {
  const key = randomBytes(32);

  describe('encryptLdapBindPassword / decryptLdapBindPassword', () => {
    test('decrypts back to the original plain text', () => {
      const encrypted = encryptLdapBindPassword('senha-super-secreta', key);
      expect(decryptLdapBindPassword(encrypted, key)).toBe('senha-super-secreta');
    });

    test('produces a different ciphertext on every call (random IV)', () => {
      const first = encryptLdapBindPassword('mesma-senha', key);
      const second = encryptLdapBindPassword('mesma-senha', key);
      expect(first).not.toBe(second);
    });

    test('throws when the payload format is invalid', () => {
      expect(() => decryptLdapBindPassword('formato-invalido', key)).toThrow(
        'Payload de senha LDAP criptografada em formato invalido',
      );
    });

    test('throws when the ciphertext was tampered with', () => {
      const encrypted = encryptLdapBindPassword('senha', key);
      const [iv, authTag] = encrypted.split(':');
      const tampered = [iv, authTag, Buffer.from('lixo-adulterado').toString('base64')].join(':');
      expect(() => decryptLdapBindPassword(tampered, key)).toThrow();
    });
  });

  describe('parseLdapEncryptionKey', () => {
    test('returns a 32-byte buffer for a valid base64-encoded key', () => {
      const validKey = randomBytes(32).toString('base64');
      expect(parseLdapEncryptionKey(validKey).length).toBe(32);
    });

    test('throws when the decoded key is not 32 bytes', () => {
      const shortKey = randomBytes(16).toString('base64');
      expect(() => parseLdapEncryptionKey(shortKey)).toThrow('32 bytes');
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-crypto.util.spec.ts`
Expected: FAIL — `Cannot find module './ldap-crypto.util'`.

- [ ] **Step 3: Implementar**

Create `apps/api/src/ldap/ldap-crypto.util.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

export function parseLdapEncryptionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `LDAP_CONFIG_ENCRYPTION_KEY deve decodificar para ${KEY_LENGTH_BYTES} bytes em base64 (recebido: ${key.length})`,
    );
  }
  return key;
}

// Formato armazenado: "<iv base64>:<authTag base64>:<ciphertext base64>"
export function encryptLdapBindPassword(plainText: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptLdapBindPassword(payload: string, key: Buffer): string {
  const [ivB64, authTagB64, cipherTextB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !cipherTextB64) {
    throw new Error('Payload de senha LDAP criptografada em formato invalido');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherTextB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-crypto.util.spec.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/ldap/ldap-crypto.util.ts apps/api/src/ldap/ldap-crypto.util.spec.ts
git commit -m "feat(ldap): adiciona criptografia AES-256-GCM da senha de bind"
```

---

## Task 4: Utilitário de parsing de identifier com domínio (`ldap-identifier.util.ts`)

**Files:**
- Create: `apps/api/src/ldap/ldap-identifier.util.ts`
- Test: `apps/api/src/ldap/ldap-identifier.util.spec.ts`

**Interfaces:**
- Produces: `parseDomainQualifiedIdentifier(identifier: string): { domain: string; username: string } | null`. Consumido pela Task 12 (`AuthService.authenticate`).

- [ ] **Step 1: Escrever o teste (RED)**

Create `apps/api/src/ldap/ldap-identifier.util.spec.ts`:

```typescript
import { parseDomainQualifiedIdentifier } from './ldap-identifier.util';

describe('parseDomainQualifiedIdentifier', () => {
  test('parses down-level logon format (DOMINIO\\usuario)', () => {
    expect(parseDomainQualifiedIdentifier('EMPRESA\\jsilva')).toEqual({ domain: 'EMPRESA', username: 'jsilva' });
  });

  test('parses UPN format (usuario@dominio)', () => {
    expect(parseDomainQualifiedIdentifier('jsilva@empresa.local')).toEqual({
      domain: 'empresa.local',
      username: 'jsilva',
    });
  });

  test('returns null for a plain identifier without a domain qualifier', () => {
    expect(parseDomainQualifiedIdentifier('jsilva')).toBeNull();
  });

  test('trims whitespace around domain and username', () => {
    expect(parseDomainQualifiedIdentifier(' EMPRESA \\ jsilva ')).toEqual({ domain: 'EMPRESA', username: 'jsilva' });
  });

  test('returns null for an empty string', () => {
    expect(parseDomainQualifiedIdentifier('')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-identifier.util.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `apps/api/src/ldap/ldap-identifier.util.ts`:

```typescript
export interface DomainQualifiedIdentifier {
  domain: string;
  username: string;
}

// Aceita os dois formatos que o Windows usa no login: down-level
// "DOMINIO\usuario" e UPN "usuario@dominio". Retorna null quando o
// identifier nao carrega dominio (login local por matricula/e-mail, ou
// usuario LDAP ja provisionado que loga so com o username).
export function parseDomainQualifiedIdentifier(identifier: string): DomainQualifiedIdentifier | null {
  const downLevelMatch = identifier.match(/^([^\\]+)\\(.+)$/);
  if (downLevelMatch) {
    const [, domain, username] = downLevelMatch;
    return { domain: domain.trim(), username: username.trim() };
  }

  const upnMatch = identifier.match(/^([^@]+)@([^@]+)$/);
  if (upnMatch) {
    const [, username, domain] = upnMatch;
    return { domain: domain.trim(), username: username.trim() };
  }

  return null;
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-identifier.util.spec.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/ldap/ldap-identifier.util.ts apps/api/src/ldap/ldap-identifier.util.spec.ts
git commit -m "feat(ldap): adiciona parsing de identifier com dominio (DOMINIO\\usuario / usuario@dominio)"
```

---

## Task 5: Utilitário de escaping RFC 4515 (`ldap-filter.util.ts`)

**Files:**
- Create: `apps/api/src/ldap/ldap-filter.util.ts`
- Test: `apps/api/src/ldap/ldap-filter.util.spec.ts`

**Interfaces:**
- Produces: `escapeLdapFilterValue(value: string): string`. Consumido pela Task 7 (`LdapClientService`).

- [ ] **Step 1: Escrever o teste (RED)**

Create `apps/api/src/ldap/ldap-filter.util.spec.ts`:

```typescript
import { escapeLdapFilterValue } from './ldap-filter.util';

describe('escapeLdapFilterValue', () => {
  test('escapes backslash, asterisk, parentheses and NUL per RFC 4515', () => {
    expect(escapeLdapFilterValue('a\\b*c(d)e f')).toBe('a\\5cb\\2ac\\28d\\29e\\00f');
  });

  test('leaves a value with no special characters unchanged', () => {
    expect(escapeLdapFilterValue('jsilva')).toBe('jsilva');
  });

  test('neutralizes a filter injection attempt', () => {
    const malicious = '*)(uid=*))(|(uid=*';
    expect(escapeLdapFilterValue(malicious)).not.toContain('*)(');
    expect(escapeLdapFilterValue(malicious)).not.toContain(')(|');
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-filter.util.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `apps/api/src/ldap/ldap-filter.util.ts`:

```typescript
// Escaping RFC 4515 para valores interpolados em filtros LDAP — sem isso,
// um username como "*)(uid=*))(|(uid=*" poderia alterar a logica do filtro
// de busca (LDAP injection).
const ESCAPE_MAP: Record<string, string> = {
  '\\': '\\5c',
  '*': '\\2a',
  '(': '\\28',
  ')': '\\29',
  ' ': '\\00',
};

export function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*() ]/g, (char) => ESCAPE_MAP[char]);
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-filter.util.spec.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/ldap/ldap-filter.util.ts apps/api/src/ldap/ldap-filter.util.spec.ts
git commit -m "feat(ldap): adiciona escaping RFC 4515 para filtros LDAP"
```

---

## Task 6: Sincronismo de cargo a partir dos grupos (`role-sync.util.ts`)

**Files:**
- Create: `apps/api/src/ldap/role-sync.util.ts`
- Test: `apps/api/src/ldap/role-sync.util.spec.ts`

**Interfaces:**
- Consumes: `RoleName` de `@prisma/client`.
- Produces: `resolveRoleFromGroups(memberOfGroupDns: string[], mappings: { groupDn: string; role: RoleName }[]): { autoRole: RoleName | null; elevationCandidates: { role: RoleName; sourceGroupDn: string }[] }`. Consumido pela Task 11 (`LdapAuthService`).

- [ ] **Step 1: Escrever o teste (RED)**

Create `apps/api/src/ldap/role-sync.util.spec.ts`:

```typescript
import { RoleName } from '@prisma/client';
import { resolveRoleFromGroups } from './role-sync.util';

describe('resolveRoleFromGroups', () => {
  const revisores = 'CN=Revisores,OU=Grupos,DC=empresa,DC=local';
  const elaboradores = 'CN=Elaboradores,OU=Grupos,DC=empresa,DC=local';
  const observadores = 'CN=Observadores,OU=Grupos,DC=empresa,DC=local';
  const aprovadores = 'CN=Aprovadores,OU=Grupos,DC=empresa,DC=local';
  const administradores = 'CN=Administradores,OU=Grupos,DC=empresa,DC=local';

  const mappings = [
    { groupDn: revisores, role: RoleName.REVISOR },
    { groupDn: elaboradores, role: RoleName.ELABORADOR },
    { groupDn: observadores, role: RoleName.OBSERVADOR },
    { groupDn: aprovadores, role: RoleName.APROVADOR },
    { groupDn: administradores, role: RoleName.ADMINISTRADOR },
  ];

  test('returns null autoRole and no candidates when no group matches', () => {
    const result = resolveRoleFromGroups(['CN=Outro,DC=empresa,DC=local'], mappings);
    expect(result).toEqual({ autoRole: null, elevationCandidates: [] });
  });

  test('resolves a single matching O/E/R group', () => {
    const result = resolveRoleFromGroups([elaboradores], mappings);
    expect(result.autoRole).toBe(RoleName.ELABORADOR);
  });

  test('prioritizes Revisor over Elaborador over Observador when the user is in multiple groups', () => {
    const result = resolveRoleFromGroups([observadores, elaboradores, revisores], mappings);
    expect(result.autoRole).toBe(RoleName.REVISOR);
  });

  test('is case-insensitive when comparing group DNs', () => {
    const result = resolveRoleFromGroups([elaboradores.toUpperCase()], mappings);
    expect(result.autoRole).toBe(RoleName.ELABORADOR);
  });

  test('does not include Aprovador/Administrador groups in autoRole, only as elevation candidates', () => {
    const result = resolveRoleFromGroups([aprovadores, administradores], mappings);
    expect(result.autoRole).toBeNull();
    expect(result.elevationCandidates).toEqual([
      { role: RoleName.APROVADOR, sourceGroupDn: aprovadores },
      { role: RoleName.ADMINISTRADOR, sourceGroupDn: administradores },
    ]);
  });

  test('combines an O/E/R autoRole with elevation candidates in the same login', () => {
    const result = resolveRoleFromGroups([elaboradores, administradores], mappings);
    expect(result.autoRole).toBe(RoleName.ELABORADOR);
    expect(result.elevationCandidates).toEqual([{ role: RoleName.ADMINISTRADOR, sourceGroupDn: administradores }]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd apps/api && npx jest role-sync.util.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `apps/api/src/ldap/role-sync.util.ts`:

```typescript
import { RoleName } from '@prisma/client';

export interface GroupMappingInput {
  groupDn: string;
  role: RoleName;
}

export interface ElevationCandidate {
  role: RoleName;
  sourceGroupDn: string;
}

export interface RoleSyncResult {
  autoRole: RoleName | null;
  elevationCandidates: ElevationCandidate[];
}

const AUTO_ROLE_PRIORITY: RoleName[] = [RoleName.REVISOR, RoleName.ELABORADOR, RoleName.OBSERVADOR];
const ELEVATED_ROLES: RoleName[] = [RoleName.APROVADOR, RoleName.ADMINISTRADOR];

// Calcula o cargo automatico (O/E/R, prioridade Revisor > Elaborador >
// Observador) e as candidaturas a elevacao (Aprovador/Administrador, que
// nunca sao aplicadas automaticamente) a partir dos grupos do AD do usuario.
export function resolveRoleFromGroups(memberOfGroupDns: string[], mappings: GroupMappingInput[]): RoleSyncResult {
  const normalizedMemberships = new Set(memberOfGroupDns.map((dn) => dn.toLowerCase()));
  const matchedMappings = mappings.filter((mapping) => normalizedMemberships.has(mapping.groupDn.toLowerCase()));

  const autoRole =
    AUTO_ROLE_PRIORITY.find((role) => matchedMappings.some((mapping) => mapping.role === role)) ?? null;

  const elevationCandidates: ElevationCandidate[] = ELEVATED_ROLES.flatMap((elevatedRole) => {
    const match = matchedMappings.find((mapping) => mapping.role === elevatedRole);
    return match ? [{ role: elevatedRole, sourceGroupDn: match.groupDn }] : [];
  });

  return { autoRole, elevationCandidates };
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest role-sync.util.spec.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/ldap/role-sync.util.ts apps/api/src/ldap/role-sync.util.spec.ts
git commit -m "feat(ldap): adiciona resolucao de cargo a partir dos grupos do AD"
```

---

## Task 7: Cliente LDAP (`LdapClientService`)

**Files:**
- Modify: `apps/api/package.json` (dependência `ldapts`)
- Create: `apps/api/src/ldap/ldap-client.service.ts`
- Test: `apps/api/src/ldap/ldap-client.service.spec.ts`

**Interfaces:**
- Consumes: `escapeLdapFilterValue` (Task 5).
- Produces: `LdapConnectionConfig` (`{ hosts, port, useTls, bindDn, bindPassword, baseDn }`), `LdapAuthenticatedProfile` (`{ userDn, nome, sobrenome, email, groupDns, accountDisabled }`), `LdapClientService.authenticate(config, username, password): Promise<LdapAuthenticatedProfile | null>`. Consumido pela Task 11 (`LdapAuthService`).

- [ ] **Step 1: Instalar a dependência**

Run (a partir da raiz do monorepo):
```bash
npm install ldapts@^9 --workspace apps/api
```
Expected: `ldapts` adicionado em `apps/api/package.json` e no lockfile raiz.

- [ ] **Step 2: Escrever o teste (RED)**

Create `apps/api/src/ldap/ldap-client.service.spec.ts`:

```typescript
import { Client } from 'ldapts';
import { LdapClientService, LdapConnectionConfig } from './ldap-client.service';

jest.mock('ldapts');

describe('LdapClientService', () => {
  let service: LdapClientService;
  let bindMock: jest.Mock;
  let searchMock: jest.Mock;
  let unbindMock: jest.Mock;

  const config: LdapConnectionConfig = {
    hosts: ['dc1.empresa.local'],
    port: 636,
    useTls: true,
    bindDn: 'CN=svc-formops,OU=Service,DC=empresa,DC=local',
    bindPassword: 'service-account-password',
    baseDn: 'DC=empresa,DC=local',
  };

  beforeEach(() => {
    bindMock = jest.fn().mockResolvedValue(undefined);
    searchMock = jest.fn();
    unbindMock = jest.fn().mockResolvedValue(undefined);
    (Client as unknown as jest.Mock).mockImplementation(() => ({
      bind: bindMock,
      search: searchMock,
      unbind: unbindMock,
    }));
    service = new LdapClientService();
  });

  test('returns null when the username is not found on any configured host', async () => {
    searchMock.mockResolvedValue({ searchEntries: [] });

    const result = await service.authenticate(config, 'jsilva', 'senha');

    expect(result).toBeNull();
  });

  test('returns null when the user is found but the password bind fails', async () => {
    searchMock.mockResolvedValue({
      searchEntries: [
        {
          dn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
          givenName: 'Joao',
          sn: 'Silva',
          mail: 'joao.silva@empresa.local',
          memberOf: ['CN=Elaboradores,OU=Grupos,DC=empresa,DC=local'],
          userAccountControl: '512',
        },
      ],
    });
    bindMock
      .mockResolvedValueOnce(undefined) // bind da conta de servico
      .mockRejectedValueOnce(new Error('Invalid Credentials')); // bind como o usuario

    const result = await service.authenticate(config, 'jsilva', 'senha-errada');

    expect(result).toBeNull();
  });

  test('returns the profile with groups and accountDisabled=false on successful authentication', async () => {
    searchMock.mockResolvedValue({
      searchEntries: [
        {
          dn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
          givenName: 'Joao',
          sn: 'Silva',
          mail: 'joao.silva@empresa.local',
          memberOf: ['CN=Elaboradores,OU=Grupos,DC=empresa,DC=local'],
          userAccountControl: '512',
        },
      ],
    });
    bindMock.mockResolvedValue(undefined);

    const result = await service.authenticate(config, 'jsilva', 'senha-correta');

    expect(result).toEqual({
      userDn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
      nome: 'Joao',
      sobrenome: 'Silva',
      email: 'joao.silva@empresa.local',
      groupDns: ['CN=Elaboradores,OU=Grupos,DC=empresa,DC=local'],
      accountDisabled: false,
    });
  });

  test('marks accountDisabled=true when userAccountControl has the ACCOUNTDISABLE bit set', async () => {
    searchMock.mockResolvedValue({
      searchEntries: [
        {
          dn: 'CN=Joao Silva,OU=Usuarios,DC=empresa,DC=local',
          givenName: 'Joao',
          sn: 'Silva',
          mail: 'joao.silva@empresa.local',
          memberOf: [],
          userAccountControl: '514', // 512 + 2 (ACCOUNTDISABLE)
        },
      ],
    });
    bindMock.mockResolvedValue(undefined);

    const result = await service.authenticate(config, 'jsilva', 'senha-correta');

    expect(result?.accountDisabled).toBe(true);
  });

  test('tries the next host when the first one fails to connect', async () => {
    const multiHostConfig: LdapConnectionConfig = { ...config, hosts: ['dc1.empresa.local', 'dc2.empresa.local'] };
    bindMock.mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue(undefined);
    searchMock.mockResolvedValue({ searchEntries: [] });

    const result = await service.authenticate(multiHostConfig, 'jsilva', 'senha');

    expect(result).toBeNull();
    expect(Client).toHaveBeenCalledTimes(2);
  });

  test('throws when every configured host fails to connect', async () => {
    bindMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.authenticate(config, 'jsilva', 'senha')).rejects.toThrow(
      'Nenhum controlador de dominio configurado respondeu a busca do usuario',
    );
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-client.service.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar**

Create `apps/api/src/ldap/ldap-client.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ldapts';
import { escapeLdapFilterValue } from './ldap-filter.util';

export interface LdapConnectionConfig {
  hosts: string[];
  port: number;
  useTls: boolean;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
}

export interface LdapAuthenticatedProfile {
  userDn: string;
  nome: string;
  sobrenome: string;
  email: string;
  groupDns: string[];
  accountDisabled: boolean;
}

const CONNECT_TIMEOUT_MS = 5000;
const ACCOUNTDISABLE_BIT = 0x2;

@Injectable()
export class LdapClientService {
  private readonly logger = new Logger(LdapClientService.name);

  async authenticate(
    config: LdapConnectionConfig,
    username: string,
    password: string,
  ): Promise<LdapAuthenticatedProfile | null> {
    const found = await this.findUserEntry(config, username);
    if (!found) {
      return null;
    }

    const credentialsValid = await this.verifyUserPassword(config, found.host, found.profile.userDn, password);
    return credentialsValid ? found.profile : null;
  }

  private async findUserEntry(
    config: LdapConnectionConfig,
    username: string,
  ): Promise<{ profile: LdapAuthenticatedProfile; host: string } | null> {
    let anyHostConnected = false;

    for (const host of config.hosts) {
      const client = this.createClient(host, config);
      try {
        await client.bind(config.bindDn, config.bindPassword);
        anyHostConnected = true;

        const filter = `(&(objectClass=user)(sAMAccountName=${escapeLdapFilterValue(username)}))`;
        const { searchEntries } = await client.search(config.baseDn, {
          scope: 'sub',
          filter,
          attributes: ['distinguishedName', 'givenName', 'sn', 'mail', 'memberOf', 'userAccountControl'],
        });

        if (searchEntries.length === 0) {
          return null;
        }

        const raw = searchEntries[0] as Record<string, unknown>;
        const userAccountControl = Number(raw.userAccountControl ?? 0);
        return {
          host,
          profile: {
            userDn: String(raw.dn),
            nome: String(raw.givenName ?? username),
            sobrenome: String(raw.sn ?? ''),
            email: String(raw.mail ?? ''),
            groupDns: this.toStringArray(raw.memberOf),
            accountDisabled: (userAccountControl & ACCOUNTDISABLE_BIT) === ACCOUNTDISABLE_BIT,
          },
        };
      } catch (error) {
        this.logger.warn(`Falha ao consultar o DC ${host}: ${(error as Error).message}`);
        continue;
      } finally {
        await this.safeUnbind(client);
      }
    }

    if (!anyHostConnected) {
      throw new Error('Nenhum controlador de dominio configurado respondeu a busca do usuario');
    }
    return null;
  }

  private async verifyUserPassword(
    config: LdapConnectionConfig,
    host: string,
    userDn: string,
    password: string,
  ): Promise<boolean> {
    const client = this.createClient(host, config);
    try {
      await client.bind(userDn, password);
      return true;
    } catch {
      return false;
    } finally {
      await this.safeUnbind(client);
    }
  }

  private createClient(host: string, config: LdapConnectionConfig): Client {
    const protocol = config.useTls ? 'ldaps' : 'ldap';
    return new Client({
      url: `${protocol}://${host}:${config.port}`,
      connectTimeout: CONNECT_TIMEOUT_MS,
      timeout: CONNECT_TIMEOUT_MS,
    });
  }

  private async safeUnbind(client: Client): Promise<void> {
    try {
      await client.unbind();
    } catch {
      // conexao pode ja ter caido — nao ha nada a fazer alem de ignorar.
    }
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (typeof value === 'string') {
      return [value];
    }
    return [];
  }
}
```

Nota sobre o Step 6 do teste ("tries the next host"): a implementação usa uma flag `anyHostConnected` para só lançar o erro final quando **nenhum** host respondeu; se algum host respondeu e simplesmente não achou o usuário, retorna `null` (credenciais inválidas), não erro.

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-client.service.spec.ts`
Expected: PASS (6 testes).

- [ ] **Step 6: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/package.json apps/api/package-lock.json apps/api/src/ldap/ldap-client.service.ts apps/api/src/ldap/ldap-client.service.spec.ts
git commit -m "feat(ldap): adiciona LdapClientService (bind, busca de usuario e grupos via ldapts)"
```

---

## Task 8: CRUD de configurações LDAP por unidade (`LdapConfigsService` + Controller)

**Files:**
- Create: `apps/api/src/ldap/dto/create-ldap-config.dto.ts`
- Create: `apps/api/src/ldap/dto/update-ldap-config.dto.ts`
- Create: `apps/api/src/ldap/ldap-configs.service.ts`
- Test: `apps/api/src/ldap/ldap-configs.service.spec.ts`
- Create: `apps/api/src/ldap/ldap-configs.controller.ts`
- Test: `apps/api/src/ldap/ldap-configs.controller.spec.ts`
- Create: `apps/api/src/ldap/ldap.module.ts`

**Interfaces:**
- Consumes: `parseLdapEncryptionKey`, `encryptLdapBindPassword`, `decryptLdapBindPassword` (Task 3).
- Produces: `LdapConfigsService.findAllByUnit(unitId)`, `.create(unitId, dto)`, `.update(unitId, id, dto)`, `.setActive(unitId, id, isActive)`, `.getConnectionConfig(id): Promise<{ id, unitId, hosts, port, useTls, bindDn, bindPassword, baseDn } | null>`, `.findActiveByDomain(domain)`. Consumido pela Task 11 (`LdapAuthService`).

- [ ] **Step 1: Criar os DTOs**

Create `apps/api/src/ldap/dto/create-ldap-config.dto.ts`:

```typescript
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateLdapConfigDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  hosts!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  useTls?: boolean;

  @IsString()
  @IsNotEmpty()
  bindDn!: string;

  @IsString()
  @IsNotEmpty()
  bindPassword!: string;

  @IsString()
  @IsNotEmpty()
  baseDn!: string;
}
```

Create `apps/api/src/ldap/dto/update-ldap-config.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateLdapConfigDto } from './create-ldap-config.dto';

export class UpdateLdapConfigDto extends PartialType(CreateLdapConfigDto) {}
```

- [ ] **Step 2: Escrever o teste do service (RED)**

Create `apps/api/src/ldap/ldap-configs.service.spec.ts`:

```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LdapConfigsService } from './ldap-configs.service';

function buildUniqueConstraintError(target: string[]): Prisma.PrismaClientKnownRequestError {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: 'P2002',
    meta: { target },
    message: 'Unique constraint failed',
  });
}

describe('LdapConfigsService', () => {
  let service: LdapConfigsService;
  let findManyMock: jest.Mock;
  let findUniqueUnitMock: jest.Mock;
  let findUniqueConfigMock: jest.Mock;
  let createMock: jest.Mock;
  let updateMock: jest.Mock;

  const encryptionKeyB64 = randomBytes(32).toString('base64');

  beforeEach(() => {
    findManyMock = jest.fn();
    findUniqueUnitMock = jest.fn();
    findUniqueConfigMock = jest.fn();
    createMock = jest.fn();
    updateMock = jest.fn();
    const prisma = {
      ldapConfig: { findMany: findManyMock, findUnique: findUniqueConfigMock, create: createMock, update: updateMock },
      unit: { findUnique: findUniqueUnitMock },
    } as unknown as PrismaService;
    const configService = { getOrThrow: jest.fn().mockReturnValue(encryptionKeyB64) } as unknown as ConfigService;
    service = new LdapConfigsService(prisma, configService);
  });

  describe('findAllByUnit', () => {
    test('throws NotFoundException when the unit does not exist', async () => {
      findUniqueUnitMock.mockResolvedValue(null);

      await expect(service.findAllByUnit('missing-unit')).rejects.toThrow(NotFoundException);
    });

    test('returns configs without the encrypted password field', async () => {
      findUniqueUnitMock.mockResolvedValue({ id: 'unit-1' });
      findManyMock.mockResolvedValue([
        { id: 'cfg-1', unitId: 'unit-1', name: 'AD Matriz', bindPasswordEncrypted: 'iv:tag:cipher' },
      ]);

      const result = await service.findAllByUnit('unit-1');

      expect(result).toEqual([{ id: 'cfg-1', unitId: 'unit-1', name: 'AD Matriz' }]);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'AD Matriz',
      domain: 'EMPRESA',
      hosts: ['dc1.empresa.local'],
      bindDn: 'CN=svc,DC=empresa,DC=local',
      bindPassword: 'service-account-password',
      baseDn: 'DC=empresa,DC=local',
    };

    test('throws NotFoundException when the unit does not exist', async () => {
      findUniqueUnitMock.mockResolvedValue(null);

      await expect(service.create('missing-unit', dto)).rejects.toThrow(NotFoundException);
    });

    test('encrypts the bind password before persisting and redacts it on return', async () => {
      findUniqueUnitMock.mockResolvedValue({ id: 'unit-1' });
      createMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1', ...dto, bindPasswordEncrypted: 'iv:tag:cipher' });

      const result = await service.create('unit-1', dto);

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitId: 'unit-1',
            bindPasswordEncrypted: expect.not.stringContaining('service-account-password'),
          }),
        }),
      );
      expect(result).not.toHaveProperty('bindPasswordEncrypted');
    });

    test('translates a duplicate domain into ConflictException', async () => {
      findUniqueUnitMock.mockResolvedValue({ id: 'unit-1' });
      createMock.mockRejectedValue(buildUniqueConstraintError(['domain']));

      await expect(service.create('unit-1', dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    test('re-encrypts the bind password only when a new one is provided', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      updateMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1', name: 'Novo nome', bindPasswordEncrypted: 'x' });

      await service.update('unit-1', 'cfg-1', { name: 'Novo nome' });

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: { name: 'Novo nome' },
      });
    });

    test('throws NotFoundException when the config does not belong to the unit', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'other-unit' });

      await expect(service.update('unit-1', 'cfg-1', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('setActive', () => {
    test('flips isActive for a config belonging to the unit', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      updateMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1', isActive: false, bindPasswordEncrypted: 'x' });

      await service.setActive('unit-1', 'cfg-1', false);

      expect(updateMock).toHaveBeenCalledWith({ where: { id: 'cfg-1' }, data: { isActive: false } });
    });
  });

  describe('getConnectionConfig', () => {
    test('returns null when the config does not exist or is inactive', async () => {
      findUniqueConfigMock.mockResolvedValue(null);
      expect(await service.getConnectionConfig('missing')).toBeNull();

      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', isActive: false });
      expect(await service.getConnectionConfig('cfg-1')).toBeNull();
    });

    test('returns the connection details with the decrypted password', async () => {
      const { encryptLdapBindPassword, parseLdapEncryptionKey } = jest.requireActual('./ldap-crypto.util');
      const key = parseLdapEncryptionKey(encryptionKeyB64);
      const encrypted = encryptLdapBindPassword('service-account-password', key);
      findUniqueConfigMock.mockResolvedValue({
        id: 'cfg-1',
        unitId: 'unit-1',
        hosts: ['dc1.empresa.local'],
        port: 636,
        useTls: true,
        bindDn: 'CN=svc,DC=empresa,DC=local',
        bindPasswordEncrypted: encrypted,
        baseDn: 'DC=empresa,DC=local',
        isActive: true,
      });

      const result = await service.getConnectionConfig('cfg-1');

      expect(result?.bindPassword).toBe('service-account-password');
    });
  });

  describe('findActiveByDomain', () => {
    test('delegates to prisma.ldapConfig.findFirst', async () => {
      const findFirstMock = jest.fn().mockResolvedValue({ id: 'cfg-1' });
      (service as unknown as { prisma: { ldapConfig: { findFirst: jest.Mock } } }).prisma = {
        ldapConfig: { findFirst: findFirstMock },
      };

      await service.findActiveByDomain('EMPRESA');

      expect(findFirstMock).toHaveBeenCalledWith({ where: { domain: 'EMPRESA', isActive: true } });
    });
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-configs.service.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar o service**

Create `apps/api/src/ldap/ldap-configs.service.ts`:

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LdapConfig, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLdapConfigDto } from './dto/create-ldap-config.dto';
import { UpdateLdapConfigDto } from './dto/update-ldap-config.dto';
import { decryptLdapBindPassword, encryptLdapBindPassword, parseLdapEncryptionKey } from './ldap-crypto.util';

export type LdapConfigSafe = Omit<LdapConfig, 'bindPasswordEncrypted'>;

export interface LdapConnectionDetails {
  id: string;
  unitId: string;
  hosts: string[];
  port: number;
  useTls: boolean;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
}

@Injectable()
export class LdapConfigsService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = parseLdapEncryptionKey(this.configService.getOrThrow<string>('LDAP_CONFIG_ENCRYPTION_KEY'));
  }

  async findAllByUnit(unitId: string): Promise<LdapConfigSafe[]> {
    await this.ensureUnitExists(unitId);
    const configs = await this.prisma.ldapConfig.findMany({ where: { unitId }, orderBy: { name: 'asc' } });
    return configs.map((config) => this.redact(config));
  }

  async create(unitId: string, dto: CreateLdapConfigDto): Promise<LdapConfigSafe> {
    await this.ensureUnitExists(unitId);
    try {
      const created = await this.prisma.ldapConfig.create({
        data: {
          unitId,
          name: dto.name,
          domain: dto.domain,
          hosts: dto.hosts,
          port: dto.port ?? 636,
          useTls: dto.useTls ?? true,
          bindDn: dto.bindDn,
          bindPasswordEncrypted: encryptLdapBindPassword(dto.bindPassword, this.encryptionKey),
          baseDn: dto.baseDn,
        },
      });
      return this.redact(created);
    } catch (error) {
      throw this.translateUniqueConstraintError(error);
    }
  }

  async update(unitId: string, id: string, dto: UpdateLdapConfigDto): Promise<LdapConfigSafe> {
    await this.ensureExists(unitId, id);
    const { bindPassword, ...rest } = dto;
    try {
      const updated = await this.prisma.ldapConfig.update({
        where: { id },
        data: {
          ...rest,
          ...(bindPassword
            ? { bindPasswordEncrypted: encryptLdapBindPassword(bindPassword, this.encryptionKey) }
            : {}),
        },
      });
      return this.redact(updated);
    } catch (error) {
      throw this.translateUniqueConstraintError(error);
    }
  }

  async setActive(unitId: string, id: string, isActive: boolean): Promise<LdapConfigSafe> {
    await this.ensureExists(unitId, id);
    const updated = await this.prisma.ldapConfig.update({ where: { id }, data: { isActive } });
    return this.redact(updated);
  }

  // Uso interno (fluxo de login) — unica leitura que retorna a senha decriptada.
  async getConnectionConfig(id: string): Promise<LdapConnectionDetails | null> {
    const config = await this.prisma.ldapConfig.findUnique({ where: { id } });
    if (!config || !config.isActive) {
      return null;
    }
    return {
      id: config.id,
      unitId: config.unitId,
      hosts: config.hosts,
      port: config.port,
      useTls: config.useTls,
      bindDn: config.bindDn,
      bindPassword: decryptLdapBindPassword(config.bindPasswordEncrypted, this.encryptionKey),
      baseDn: config.baseDn,
    };
  }

  findActiveByDomain(domain: string) {
    return this.prisma.ldapConfig.findFirst({ where: { domain, isActive: true } });
  }

  private redact(config: LdapConfig): LdapConfigSafe {
    const { bindPasswordEncrypted: _bindPasswordEncrypted, ...safe } = config;
    return safe;
  }

  private async ensureUnitExists(unitId: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException('Unidade nao encontrada');
    }
  }

  private async ensureExists(unitId: string, id: string): Promise<LdapConfig> {
    const config = await this.prisma.ldapConfig.findUnique({ where: { id } });
    if (!config || config.unitId !== unitId) {
      throw new NotFoundException('Configuracao LDAP nao encontrada para esta unidade');
    }
    return config;
  }

  private translateUniqueConstraintError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'campo unico';
      return new ConflictException(`Valor duplicado para: ${target}`);
    }
    return error;
  }
}
```

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-configs.service.spec.ts`
Expected: PASS (9 testes).

- [ ] **Step 6: Escrever o teste do controller (RED)**

Create `apps/api/src/ldap/ldap-configs.controller.spec.ts`:

```typescript
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';

describe('LdapConfigsController', () => {
  let controller: LdapConfigsController;
  let findAllByUnitMock: jest.Mock;
  let createMock: jest.Mock;
  let updateMock: jest.Mock;
  let setActiveMock: jest.Mock;

  beforeEach(() => {
    findAllByUnitMock = jest.fn().mockResolvedValue([]);
    createMock = jest.fn().mockResolvedValue({ id: 'cfg-1' });
    updateMock = jest.fn().mockResolvedValue({ id: 'cfg-1' });
    setActiveMock = jest.fn().mockResolvedValue({ id: 'cfg-1' });
    const service = {
      findAllByUnit: findAllByUnitMock,
      create: createMock,
      update: updateMock,
      setActive: setActiveMock,
    } as unknown as LdapConfigsService;
    controller = new LdapConfigsController(service);
  });

  test('findAll delegates to LdapConfigsService.findAllByUnit with the unitId', async () => {
    await controller.findAll('unit-1');
    expect(findAllByUnitMock).toHaveBeenCalledWith('unit-1');
  });

  test('create delegates to LdapConfigsService.create with unitId and dto', async () => {
    const dto = {
      name: 'AD Matriz',
      domain: 'EMPRESA',
      hosts: ['dc1.empresa.local'],
      bindDn: 'CN=svc,DC=empresa,DC=local',
      bindPassword: 'senha',
      baseDn: 'DC=empresa,DC=local',
    };

    await controller.create('unit-1', dto);

    expect(createMock).toHaveBeenCalledWith('unit-1', dto);
  });

  test('update delegates to LdapConfigsService.update with unitId, id and dto', async () => {
    await controller.update('unit-1', 'cfg-1', { name: 'Novo nome' });
    expect(updateMock).toHaveBeenCalledWith('unit-1', 'cfg-1', { name: 'Novo nome' });
  });

  test('deactivate/activate delegate to LdapConfigsService.setActive', async () => {
    await controller.deactivate('unit-1', 'cfg-1');
    expect(setActiveMock).toHaveBeenCalledWith('unit-1', 'cfg-1', false);

    await controller.activate('unit-1', 'cfg-1');
    expect(setActiveMock).toHaveBeenCalledWith('unit-1', 'cfg-1', true);
  });
});
```

- [ ] **Step 7: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-configs.controller.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 8: Implementar o controller e o módulo**

Create `apps/api/src/ldap/ldap-configs.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateLdapConfigDto } from './dto/create-ldap-config.dto';
import { UpdateLdapConfigDto } from './dto/update-ldap-config.dto';
import { LdapConfigsService } from './ldap-configs.service';

@Roles(RoleName.ADMINISTRADOR)
@Controller('admin/units/:unitId/ldap-configs')
export class LdapConfigsController {
  constructor(private readonly ldapConfigsService: LdapConfigsService) {}

  @Get()
  findAll(@Param('unitId') unitId: string) {
    return this.ldapConfigsService.findAllByUnit(unitId);
  }

  @Post()
  create(@Param('unitId') unitId: string, @Body() dto: CreateLdapConfigDto) {
    return this.ldapConfigsService.create(unitId, dto);
  }

  @Patch(':id')
  update(@Param('unitId') unitId: string, @Param('id') id: string, @Body() dto: UpdateLdapConfigDto) {
    return this.ldapConfigsService.update(unitId, id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('unitId') unitId: string, @Param('id') id: string) {
    return this.ldapConfigsService.setActive(unitId, id, false);
  }

  @Patch(':id/activate')
  activate(@Param('unitId') unitId: string, @Param('id') id: string) {
    return this.ldapConfigsService.setActive(unitId, id, true);
  }
}
```

Create `apps/api/src/ldap/ldap.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';

@Module({
  controllers: [LdapConfigsController],
  providers: [LdapConfigsService],
  exports: [LdapConfigsService],
})
export class LdapModule {}
```

- [ ] **Step 9: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-configs.controller.spec.ts`
Expected: PASS (4 testes).

- [ ] **Step 10: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/ldap/dto/create-ldap-config.dto.ts apps/api/src/ldap/dto/update-ldap-config.dto.ts apps/api/src/ldap/ldap-configs.service.ts apps/api/src/ldap/ldap-configs.service.spec.ts apps/api/src/ldap/ldap-configs.controller.ts apps/api/src/ldap/ldap-configs.controller.spec.ts apps/api/src/ldap/ldap.module.ts
git commit -m "feat(ldap): adiciona CRUD administrativo de configuracoes LDAP por unidade"
```

---

## Task 9: CRUD de mapeamento grupo → cargo (`LdapGroupMappingsService` + Controller)

**Files:**
- Create: `apps/api/src/ldap/dto/create-ldap-group-mapping.dto.ts`
- Create: `apps/api/src/ldap/ldap-group-mappings.service.ts`
- Test: `apps/api/src/ldap/ldap-group-mappings.service.spec.ts`
- Create: `apps/api/src/ldap/ldap-group-mappings.controller.ts`
- Test: `apps/api/src/ldap/ldap-group-mappings.controller.spec.ts`
- Modify: `apps/api/src/ldap/ldap.module.ts`

**Interfaces:**
- Produces: `LdapGroupMappingsService.findAll(unitId, ldapConfigId)`, `.create(unitId, ldapConfigId, dto)`, `.remove(unitId, ldapConfigId, id)`.

- [ ] **Step 1: Criar o DTO**

Create `apps/api/src/ldap/dto/create-ldap-group-mapping.dto.ts`:

```typescript
import { RoleName } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateLdapGroupMappingDto {
  @IsString()
  @IsNotEmpty()
  groupDn!: string;

  @IsEnum(RoleName)
  role!: RoleName;
}
```

- [ ] **Step 2: Escrever o teste do service (RED)**

Create `apps/api/src/ldap/ldap-group-mappings.service.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';

describe('LdapGroupMappingsService', () => {
  let service: LdapGroupMappingsService;
  let findUniqueConfigMock: jest.Mock;
  let findManyMock: jest.Mock;
  let createMock: jest.Mock;
  let findUniqueMappingMock: jest.Mock;
  let deleteMock: jest.Mock;

  beforeEach(() => {
    findUniqueConfigMock = jest.fn();
    findManyMock = jest.fn();
    createMock = jest.fn();
    findUniqueMappingMock = jest.fn();
    deleteMock = jest.fn();
    const prisma = {
      ldapConfig: { findUnique: findUniqueConfigMock },
      ldapGroupMapping: { findMany: findManyMock, create: createMock, findUnique: findUniqueMappingMock, delete: deleteMock },
    } as unknown as PrismaService;
    service = new LdapGroupMappingsService(prisma);
  });

  describe('findAll', () => {
    test('throws NotFoundException when the config does not belong to the unit', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'other-unit' });

      await expect(service.findAll('unit-1', 'cfg-1')).rejects.toThrow(NotFoundException);
    });

    test('lists mappings for the config', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      findManyMock.mockResolvedValue([{ id: 'map-1', groupDn: 'CN=Elaboradores,DC=empresa,DC=local', role: RoleName.ELABORADOR }]);

      const result = await service.findAll('unit-1', 'cfg-1');

      expect(findManyMock).toHaveBeenCalledWith({ where: { ldapConfigId: 'cfg-1' }, orderBy: { createdAt: 'asc' } });
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    test('creates a mapping scoped to the ldapConfigId', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      createMock.mockResolvedValue({ id: 'map-1' });

      await service.create('unit-1', 'cfg-1', { groupDn: 'CN=Revisores,DC=empresa,DC=local', role: RoleName.REVISOR });

      expect(createMock).toHaveBeenCalledWith({
        data: { ldapConfigId: 'cfg-1', groupDn: 'CN=Revisores,DC=empresa,DC=local', role: RoleName.REVISOR },
      });
    });
  });

  describe('remove', () => {
    test('throws NotFoundException when the mapping does not belong to the config', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      findUniqueMappingMock.mockResolvedValue({ id: 'map-1', ldapConfigId: 'other-cfg' });

      await expect(service.remove('unit-1', 'cfg-1', 'map-1')).rejects.toThrow(NotFoundException);
    });

    test('deletes the mapping when it belongs to the config', async () => {
      findUniqueConfigMock.mockResolvedValue({ id: 'cfg-1', unitId: 'unit-1' });
      findUniqueMappingMock.mockResolvedValue({ id: 'map-1', ldapConfigId: 'cfg-1' });

      await service.remove('unit-1', 'cfg-1', 'map-1');

      expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'map-1' } });
    });
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-group-mappings.service.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar o service**

Create `apps/api/src/ldap/ldap-group-mappings.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { LdapGroupMapping } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLdapGroupMappingDto } from './dto/create-ldap-group-mapping.dto';

@Injectable()
export class LdapGroupMappingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(unitId: string, ldapConfigId: string): Promise<LdapGroupMapping[]> {
    await this.ensureConfigExists(unitId, ldapConfigId);
    return this.prisma.ldapGroupMapping.findMany({ where: { ldapConfigId }, orderBy: { createdAt: 'asc' } });
  }

  async create(unitId: string, ldapConfigId: string, dto: CreateLdapGroupMappingDto): Promise<LdapGroupMapping> {
    await this.ensureConfigExists(unitId, ldapConfigId);
    return this.prisma.ldapGroupMapping.create({
      data: { ldapConfigId, groupDn: dto.groupDn, role: dto.role },
    });
  }

  async remove(unitId: string, ldapConfigId: string, id: string): Promise<void> {
    await this.ensureConfigExists(unitId, ldapConfigId);
    const mapping = await this.prisma.ldapGroupMapping.findUnique({ where: { id } });
    if (!mapping || mapping.ldapConfigId !== ldapConfigId) {
      throw new NotFoundException('Mapeamento de grupo nao encontrado');
    }
    await this.prisma.ldapGroupMapping.delete({ where: { id } });
  }

  private async ensureConfigExists(unitId: string, ldapConfigId: string): Promise<void> {
    const config = await this.prisma.ldapConfig.findUnique({ where: { id: ldapConfigId } });
    if (!config || config.unitId !== unitId) {
      throw new NotFoundException('Configuracao LDAP nao encontrada para esta unidade');
    }
  }
}
```

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-group-mappings.service.spec.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Escrever o teste do controller (RED)**

Create `apps/api/src/ldap/ldap-group-mappings.controller.spec.ts`:

```typescript
import { RoleName } from '@prisma/client';
import { LdapGroupMappingsController } from './ldap-group-mappings.controller';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';

describe('LdapGroupMappingsController', () => {
  let controller: LdapGroupMappingsController;
  let findAllMock: jest.Mock;
  let createMock: jest.Mock;
  let removeMock: jest.Mock;

  beforeEach(() => {
    findAllMock = jest.fn().mockResolvedValue([]);
    createMock = jest.fn().mockResolvedValue({ id: 'map-1' });
    removeMock = jest.fn().mockResolvedValue(undefined);
    const service = { findAll: findAllMock, create: createMock, remove: removeMock } as unknown as LdapGroupMappingsService;
    controller = new LdapGroupMappingsController(service);
  });

  test('findAll delegates with unitId and ldapConfigId', async () => {
    await controller.findAll('unit-1', 'cfg-1');
    expect(findAllMock).toHaveBeenCalledWith('unit-1', 'cfg-1');
  });

  test('create delegates with unitId, ldapConfigId and dto', async () => {
    const dto = { groupDn: 'CN=Revisores,DC=empresa,DC=local', role: RoleName.REVISOR };
    await controller.create('unit-1', 'cfg-1', dto);
    expect(createMock).toHaveBeenCalledWith('unit-1', 'cfg-1', dto);
  });

  test('remove delegates with unitId, ldapConfigId and id', async () => {
    await controller.remove('unit-1', 'cfg-1', 'map-1');
    expect(removeMock).toHaveBeenCalledWith('unit-1', 'cfg-1', 'map-1');
  });
});
```

- [ ] **Step 7: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-group-mappings.controller.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 8: Implementar o controller e atualizar o módulo**

Create `apps/api/src/ldap/ldap-group-mappings.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateLdapGroupMappingDto } from './dto/create-ldap-group-mapping.dto';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';

@Roles(RoleName.ADMINISTRADOR)
@Controller('admin/units/:unitId/ldap-configs/:ldapConfigId/group-mappings')
export class LdapGroupMappingsController {
  constructor(private readonly ldapGroupMappingsService: LdapGroupMappingsService) {}

  @Get()
  findAll(@Param('unitId') unitId: string, @Param('ldapConfigId') ldapConfigId: string) {
    return this.ldapGroupMappingsService.findAll(unitId, ldapConfigId);
  }

  @Post()
  create(
    @Param('unitId') unitId: string,
    @Param('ldapConfigId') ldapConfigId: string,
    @Body() dto: CreateLdapGroupMappingDto,
  ) {
    return this.ldapGroupMappingsService.create(unitId, ldapConfigId, dto);
  }

  @Delete(':id')
  remove(@Param('unitId') unitId: string, @Param('ldapConfigId') ldapConfigId: string, @Param('id') id: string) {
    return this.ldapGroupMappingsService.remove(unitId, ldapConfigId, id);
  }
}
```

Edit `apps/api/src/ldap/ldap.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';
import { LdapGroupMappingsController } from './ldap-group-mappings.controller';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';

@Module({
  controllers: [LdapConfigsController, LdapGroupMappingsController],
  providers: [LdapConfigsService, LdapGroupMappingsService],
  exports: [LdapConfigsService],
})
export class LdapModule {}
```

- [ ] **Step 9: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-group-mappings.controller.spec.ts`
Expected: PASS (3 testes).

- [ ] **Step 10: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/ldap
git commit -m "feat(ldap): adiciona CRUD de mapeamento grupo do AD -> cargo"
```

---

## Task 10: Fila de elevação de cargo (`RoleElevationRequestsService` + Controller + e-mail)

**Files:**
- Modify: `apps/api/src/notifications/email-templates.util.ts`
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/notifications.service.spec.ts` (já existe — adicionar bloco, não substituir)
- Create: `apps/api/src/ldap/role-elevation-requests.service.ts`
- Test: `apps/api/src/ldap/role-elevation-requests.service.spec.ts`
- Create: `apps/api/src/ldap/role-elevation-requests.controller.ts`
- Test: `apps/api/src/ldap/role-elevation-requests.controller.spec.ts`
- Modify: `apps/api/src/ldap/ldap.module.ts`

**Interfaces:**
- Produces: `RoleElevationRequestsService.findAll(status?)`, `.approve(id, reviewer)`, `.reject(id, reviewer)`, `.ensurePendingRequest(userId, requestedRole, sourceGroupDn)`, `.revokeStalePendingRequests(userId, stillEligibleRoles)`. Consumido pela Task 11 (`LdapAuthService`).

- [ ] **Step 1: Escrever o teste do template/e-mail (RED)**

`apps/api/src/notifications/notifications.service.spec.ts` **já existe** no repositório com 4 testes cobrindo `notifySlaOverdue`, `notifySubmittedForApproval`, `notifyReportReproved` e `notifyReportConcluded` — todos passando no baseline. **Não substitua o arquivo.** Adicione um novo bloco `describe('notifyElevationRequested', ...)` ao final do `describe('NotificationsService', ...)` existente, preservando os 4 testes atuais e o `beforeEach` já presente. O arquivo final deve ficar assim (blocos existentes inalterados, bloco novo ao final):

```typescript
import { ReportInstance, RoleName, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let findManyMock: jest.Mock;
  let sendMock: jest.Mock;

  const unit = { id: 'unit-1', sigla: 'FIL01', nome: 'Filial Um' } as Unit;
  const report = { id: 'report-1', referenceMonth: new Date('2026-07-01'), slaExtensionDueDate: null } as ReportInstance;

  beforeEach(() => {
    findManyMock = jest.fn();
    sendMock = jest.fn();
    const prisma = { user: { findMany: findManyMock } } as unknown as PrismaService;
    const emailService = { send: sendMock } as unknown as EmailService;
    service = new NotificationsService(prisma, emailService);
  });

  test('notifySlaOverdue sends only to ELABORADOR of the report unit', async () => {
    findManyMock.mockResolvedValue([{ email: 'elaborador@formops.local' }]);

    await service.notifySlaOverdue({ ...report, unit });

    expect(findManyMock).toHaveBeenCalledWith({
      where: { primaryUnitId: unit.id, role: { in: [RoleName.ELABORADOR] }, isActive: true },
      select: { email: true },
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: ['elaborador@formops.local'] }));
  });

  test('notifySubmittedForApproval queries org-wide APROVADOR without unit filter', async () => {
    findManyMock.mockResolvedValue([{ email: 'aprovador@formops.local' }]);

    await service.notifySubmittedForApproval(report, unit);

    expect(findManyMock).toHaveBeenCalledWith({
      where: { role: { in: [RoleName.APROVADOR] }, isActive: true },
      select: { email: true },
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: ['aprovador@formops.local'] }));
  });

  test('notifyReportReproved sends to both ELABORADOR and REVISOR of the unit', async () => {
    findManyMock.mockResolvedValue([{ email: 'a@formops.local' }, { email: 'b@formops.local' }]);

    await service.notifyReportReproved(report, unit);

    expect(findManyMock).toHaveBeenCalledWith({
      where: { primaryUnitId: unit.id, role: { in: [RoleName.ELABORADOR, RoleName.REVISOR] }, isActive: true },
      select: { email: true },
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: ['a@formops.local', 'b@formops.local'] }));
  });

  test('does not call EmailService.send with an empty recipient list resolved upstream', async () => {
    findManyMock.mockResolvedValue([]);

    await service.notifyReportConcluded(report, unit);

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: [] }));
  });

  describe('notifyElevationRequested', () => {
    test('sends the elevation email to every active ADMINISTRADOR', async () => {
      findManyMock.mockResolvedValue([{ email: 'admin1@empresa.local' }, { email: 'admin2@empresa.local' }]);

      await service.notifyElevationRequested(
        { nome: 'Joao', sobrenome: 'Silva', matricula: '12345' },
        RoleName.ADMINISTRADOR,
      );

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: { in: [RoleName.ADMINISTRADOR] }, isActive: true } }),
      );
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: ['admin1@empresa.local', 'admin2@empresa.local'] }),
      );
    });

    test('does not call EmailService.send when there are no administrators', async () => {
      findManyMock.mockResolvedValue([]);

      await service.notifyElevationRequested({ nome: 'Joao', sobrenome: 'Silva', matricula: '12345' }, RoleName.APROVADOR);

      expect(sendMock).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd apps/api && npx jest notifications.service.spec.ts`
Expected: FAIL apenas no novo bloco `notifyElevationRequested` (`notifyElevationRequested` não existe) — os 4 testes preexistentes continuam passando.

- [ ] **Step 3: Adicionar o template de e-mail**

Editar `apps/api/src/notifications/email-templates.util.ts`, trocando o import do topo:

```typescript
import { ReportInstance, RoleName, Unit } from '@prisma/client';
```

E adicionar, junto às demais funções `buildXEmail`:

```typescript
export function buildElevationRequestedEmail(
  user: { nome: string; sobrenome: string; matricula: string },
  requestedRole: RoleName,
): EmailContent {
  return {
    subject: '[FormOps] Solicitacao de elevacao de cargo pendente',
    html: wrapHtml('Nova solicitacao de elevacao de cargo', [
      `O usuario <strong>${escapeHtml(user.nome)} ${escapeHtml(user.sobrenome)}</strong> (matricula ${escapeHtml(user.matricula)}) foi identificado em um grupo do AD mapeado para <strong>${requestedRole}</strong>.`,
      'Acesse a fila de solicitacoes de elevacao no FormOps para aprovar ou rejeitar.',
    ]),
  };
}
```

- [ ] **Step 4: Adicionar o método no `NotificationsService`**

Editar `apps/api/src/notifications/notifications.service.ts`, adicionando `User` ao import de `@prisma/client`:

```typescript
import { ReportInstance, RoleName, Unit, User } from '@prisma/client';
```

E o import do template:

```typescript
import {
  buildElevationRequestedEmail,
  buildReportConcludedEmail,
  buildReportReprovedEmail,
  buildSlaOverdueEmail,
  buildSubmittedForApprovalEmail,
  buildSubmittedForReviewEmail,
} from './email-templates.util';
```

E o método, junto aos demais `notifyX`:

```typescript
async notifyElevationRequested(user: Pick<User, 'nome' | 'sobrenome' | 'matricula'>, requestedRole: RoleName): Promise<void> {
  const to = await this.findOrgWideRoleEmails([RoleName.ADMINISTRADOR]);
  await this.emailService.send({ to, ...buildElevationRequestedEmail(user, requestedRole) });
}
```

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest notifications.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Escrever o teste do `RoleElevationRequestsService` (RED)**

Create `apps/api/src/ldap/role-elevation-requests.service.spec.ts`:

```typescript
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ElevationStatus, RoleName } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

describe('RoleElevationRequestsService', () => {
  let service: RoleElevationRequestsService;
  let findManyMock: jest.Mock;
  let findUniqueMock: jest.Mock;
  let findFirstMock: jest.Mock;
  let createMock: jest.Mock;
  let updateManyMock: jest.Mock;
  let userUpdateMock: jest.Mock;
  let userFindUniqueMock: jest.Mock;
  let runWithAuditActorMock: jest.Mock;
  let notifyMock: jest.Mock;

  const reviewer = { id: 'admin-1' } as unknown as import('../auth/types/authenticated-user.interface').AuthenticatedUser;

  beforeEach(() => {
    findManyMock = jest.fn();
    findUniqueMock = jest.fn();
    findFirstMock = jest.fn();
    createMock = jest.fn();
    updateManyMock = jest.fn();
    userUpdateMock = jest.fn();
    userFindUniqueMock = jest.fn();
    notifyMock = jest.fn().mockResolvedValue(undefined);
    runWithAuditActorMock = jest.fn((_userId: string, fn: (tx: unknown) => unknown) =>
      fn({
        user: { update: userUpdateMock },
        roleElevationRequest: { update: jest.fn().mockResolvedValue({ id: 'req-1', status: ElevationStatus.APPROVED }) },
      }),
    );
    const prisma = {
      roleElevationRequest: { findMany: findManyMock, findUnique: findUniqueMock, findFirst: findFirstMock, create: createMock, updateMany: updateManyMock },
      user: { findUnique: userFindUniqueMock },
      runWithAuditActor: runWithAuditActorMock,
    } as unknown as PrismaService;
    const notificationsService = { notifyElevationRequested: notifyMock } as unknown as NotificationsService;
    service = new RoleElevationRequestsService(prisma, notificationsService);
  });

  describe('approve', () => {
    test('throws NotFoundException when the request does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.approve('req-1', reviewer)).rejects.toThrow(NotFoundException);
    });

    test('throws ForbiddenException when the request was already reviewed', async () => {
      findUniqueMock.mockResolvedValue({ id: 'req-1', status: ElevationStatus.APPROVED, userId: 'user-1', requestedRole: RoleName.ADMINISTRADOR });

      await expect(service.approve('req-1', reviewer)).rejects.toThrow(ForbiddenException);
    });

    test('promotes the user role and marks the request as APPROVED inside runWithAuditActor', async () => {
      findUniqueMock.mockResolvedValue({ id: 'req-1', status: ElevationStatus.PENDING, userId: 'user-1', requestedRole: RoleName.ADMINISTRADOR });

      await service.approve('req-1', reviewer);

      expect(runWithAuditActorMock).toHaveBeenCalledWith('admin-1', expect.any(Function));
      expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { role: RoleName.ADMINISTRADOR } });
    });
  });

  describe('reject', () => {
    test('throws NotFoundException when the request does not exist', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(service.reject('req-1', reviewer)).rejects.toThrow(NotFoundException);
    });
  });

  describe('ensurePendingRequest', () => {
    test('does nothing when an identical pending request already exists', async () => {
      findFirstMock.mockResolvedValue({ id: 'existing' });

      await service.ensurePendingRequest('user-1', RoleName.ADMINISTRADOR, 'CN=Admins,DC=empresa,DC=local');

      expect(createMock).not.toHaveBeenCalled();
      expect(notifyMock).not.toHaveBeenCalled();
    });

    test('creates the request and notifies administrators when none is pending', async () => {
      findFirstMock.mockResolvedValue(null);
      userFindUniqueMock.mockResolvedValue({ id: 'user-1', nome: 'Joao', sobrenome: 'Silva', matricula: '12345' });

      await service.ensurePendingRequest('user-1', RoleName.ADMINISTRADOR, 'CN=Admins,DC=empresa,DC=local');

      expect(createMock).toHaveBeenCalledWith({
        data: { userId: 'user-1', requestedRole: RoleName.ADMINISTRADOR, sourceGroupDn: 'CN=Admins,DC=empresa,DC=local' },
      });
      expect(notifyMock).toHaveBeenCalledWith(
        { id: 'user-1', nome: 'Joao', sobrenome: 'Silva', matricula: '12345' },
        RoleName.ADMINISTRADOR,
      );
    });
  });

  describe('revokeStalePendingRequests', () => {
    test('marks pending requests outside the eligible roles as REVOKED', async () => {
      await service.revokeStalePendingRequests('user-1', [RoleName.APROVADOR]);

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: ElevationStatus.PENDING, requestedRole: { notIn: [RoleName.APROVADOR] } },
        data: { status: ElevationStatus.REVOKED },
      });
    });
  });
});
```

- [ ] **Step 7: Rodar e confirmar falha**

Run: `cd apps/api && npx jest role-elevation-requests.service.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 8: Implementar o service**

Create `apps/api/src/ldap/role-elevation-requests.service.ts`:

```typescript
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ElevationStatus, RoleElevationRequest, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoleElevationRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll(status?: ElevationStatus): Promise<RoleElevationRequest[]> {
    return this.prisma.roleElevationRequest.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, nome: true, sobrenome: true, matricula: true, primaryUnitId: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, reviewer: AuthenticatedUser): Promise<RoleElevationRequest> {
    const request = await this.ensurePending(id);
    return this.prisma.runWithAuditActor(reviewer.id, async (tx) => {
      await tx.user.update({ where: { id: request.userId }, data: { role: request.requestedRole } });
      return tx.roleElevationRequest.update({
        where: { id },
        data: { status: ElevationStatus.APPROVED, reviewedById: reviewer.id, reviewedAt: new Date() },
      });
    });
  }

  async reject(id: string, reviewer: AuthenticatedUser): Promise<RoleElevationRequest> {
    await this.ensurePending(id);
    return this.prisma.runWithAuditActor(reviewer.id, (tx) =>
      tx.roleElevationRequest.update({
        where: { id },
        data: { status: ElevationStatus.REJECTED, reviewedById: reviewer.id, reviewedAt: new Date() },
      }),
    );
  }

  // Chamado pelo LdapAuthService durante o sync de grupos no login.
  async ensurePendingRequest(userId: string, requestedRole: RoleName, sourceGroupDn: string): Promise<void> {
    const existing = await this.prisma.roleElevationRequest.findFirst({
      where: { userId, requestedRole, status: ElevationStatus.PENDING },
    });
    if (existing) {
      return;
    }

    await this.prisma.roleElevationRequest.create({ data: { userId, requestedRole, sourceGroupDn } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.notificationsService.notifyElevationRequested(user, requestedRole);
    }
  }

  // Chamado pelo LdapAuthService quando o usuario nao pertence mais a um
  // grupo que originou uma solicitacao ainda pendente.
  async revokeStalePendingRequests(userId: string, stillEligibleRoles: RoleName[]): Promise<void> {
    await this.prisma.roleElevationRequest.updateMany({
      where: { userId, status: ElevationStatus.PENDING, requestedRole: { notIn: stillEligibleRoles } },
      data: { status: ElevationStatus.REVOKED },
    });
  }

  private async ensurePending(id: string): Promise<RoleElevationRequest> {
    const request = await this.prisma.roleElevationRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Solicitacao de elevacao nao encontrada');
    }
    if (request.status !== ElevationStatus.PENDING) {
      throw new ForbiddenException('Solicitacao de elevacao ja foi revisada');
    }
    return request;
  }
}
```

- [ ] **Step 9: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest role-elevation-requests.service.spec.ts`
Expected: PASS (7 testes).

- [ ] **Step 10: Escrever o teste do controller (RED)**

Create `apps/api/src/ldap/role-elevation-requests.controller.spec.ts`:

```typescript
import { ElevationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { RoleElevationRequestsController } from './role-elevation-requests.controller';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

describe('RoleElevationRequestsController', () => {
  let controller: RoleElevationRequestsController;
  let findAllMock: jest.Mock;
  let approveMock: jest.Mock;
  let rejectMock: jest.Mock;
  const reviewer = { id: 'admin-1' } as AuthenticatedUser;

  beforeEach(() => {
    findAllMock = jest.fn().mockResolvedValue([]);
    approveMock = jest.fn().mockResolvedValue({ id: 'req-1' });
    rejectMock = jest.fn().mockResolvedValue({ id: 'req-1' });
    const service = { findAll: findAllMock, approve: approveMock, reject: rejectMock } as unknown as RoleElevationRequestsService;
    controller = new RoleElevationRequestsController(service);
  });

  test('findAll forwards the status query param', async () => {
    await controller.findAll(ElevationStatus.PENDING);
    expect(findAllMock).toHaveBeenCalledWith(ElevationStatus.PENDING);
  });

  test('approve delegates with id and reviewer', async () => {
    await controller.approve('req-1', reviewer);
    expect(approveMock).toHaveBeenCalledWith('req-1', reviewer);
  });

  test('reject delegates with id and reviewer', async () => {
    await controller.reject('req-1', reviewer);
    expect(rejectMock).toHaveBeenCalledWith('req-1', reviewer);
  });
});
```

- [ ] **Step 11: Rodar e confirmar falha**

Run: `cd apps/api && npx jest role-elevation-requests.controller.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 12: Implementar o controller e atualizar o módulo**

Create `apps/api/src/ldap/role-elevation-requests.controller.ts`:

```typescript
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ElevationStatus, RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

@Roles(RoleName.ADMINISTRADOR)
@Controller('admin/elevation-requests')
export class RoleElevationRequestsController {
  constructor(private readonly roleElevationRequestsService: RoleElevationRequestsService) {}

  @Get()
  findAll(@Query('status') status?: ElevationStatus) {
    return this.roleElevationRequestsService.findAll(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() reviewer: AuthenticatedUser) {
    return this.roleElevationRequestsService.approve(id, reviewer);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() reviewer: AuthenticatedUser) {
    return this.roleElevationRequestsService.reject(id, reviewer);
  }
}
```

Edit `apps/api/src/ldap/ldap.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';
import { LdapGroupMappingsController } from './ldap-group-mappings.controller';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';
import { RoleElevationRequestsController } from './role-elevation-requests.controller';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LdapConfigsController, LdapGroupMappingsController, RoleElevationRequestsController],
  providers: [LdapConfigsService, LdapGroupMappingsService, RoleElevationRequestsService],
  exports: [LdapConfigsService],
})
export class LdapModule {}
```

- [ ] **Step 13: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest role-elevation-requests.controller.spec.ts`
Expected: PASS (3 testes).

- [ ] **Step 14: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/ldap apps/api/src/notifications
git commit -m "feat(ldap): adiciona fila de aprovacao de elevacao para Aprovador/Administrador"
```

---

## Task 11: Orquestrador de autenticação LDAP (`LdapAuthService`)

**Files:**
- Create: `apps/api/src/ldap/ldap-auth.service.ts`
- Test: `apps/api/src/ldap/ldap-auth.service.spec.ts`
- Modify: `apps/api/src/ldap/ldap.module.ts`

**Interfaces:**
- Consumes: `LdapClientService.authenticate` (Task 7), `LdapConfigsService.getConnectionConfig`/`.findActiveByDomain` (Task 8), `RoleElevationRequestsService.ensurePendingRequest`/`.revokeStalePendingRequests` (Task 10), `resolveRoleFromGroups` (Task 6).
- Produces: `UnitSelectionRequiredException`, `LdapAuthService.listBootstrapUnits()`, `.authenticateExistingLdapUser(user, password)`, `.authenticateByDomain(domain, username, password)`, `.authenticateByUnit(unitId, username, password)` — todos retornando `AuthenticatedUser`. Consumido pela Task 12 (`AuthService`).

- [ ] **Step 1: Escrever o teste (RED)**

Create `apps/api/src/ldap/ldap-auth.service.spec.ts`:

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthSource, RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LdapAuthService, UnitSelectionRequiredException } from './ldap-auth.service';
import { LdapClientService } from './ldap-client.service';
import { LdapConfigsService } from './ldap-configs.service';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

describe('LdapAuthService', () => {
  let service: LdapAuthService;
  let unitFindManyMock: jest.Mock;
  let userCreateMock: jest.Mock;
  let userUpdateMock: jest.Mock;
  let ldapConfigFindManyMock: jest.Mock;
  let groupMappingFindManyMock: jest.Mock;
  let authenticateMock: jest.Mock;
  let getConnectionConfigMock: jest.Mock;
  let findActiveByDomainMock: jest.Mock;
  let ensurePendingRequestMock: jest.Mock;
  let revokeStaleMock: jest.Mock;

  const connection = {
    id: 'cfg-1',
    unitId: 'unit-1',
    hosts: ['dc1.empresa.local'],
    port: 636,
    useTls: true,
    bindDn: 'CN=svc,DC=empresa,DC=local',
    bindPassword: 'senha-servico',
    baseDn: 'DC=empresa,DC=local',
  };

  beforeEach(() => {
    unitFindManyMock = jest.fn();
    userCreateMock = jest.fn();
    userUpdateMock = jest.fn();
    ldapConfigFindManyMock = jest.fn();
    groupMappingFindManyMock = jest.fn();
    authenticateMock = jest.fn();
    getConnectionConfigMock = jest.fn();
    findActiveByDomainMock = jest.fn();
    ensurePendingRequestMock = jest.fn().mockResolvedValue(undefined);
    revokeStaleMock = jest.fn().mockResolvedValue(undefined);

    const prisma = {
      unit: { findMany: unitFindManyMock },
      user: { create: userCreateMock, update: userUpdateMock },
      ldapConfig: { findMany: ldapConfigFindManyMock },
      ldapGroupMapping: { findMany: groupMappingFindManyMock },
    } as unknown as PrismaService;
    const ldapClientService = { authenticate: authenticateMock } as unknown as LdapClientService;
    const ldapConfigsService = {
      getConnectionConfig: getConnectionConfigMock,
      findActiveByDomain: findActiveByDomainMock,
    } as unknown as LdapConfigsService;
    const roleElevationRequestsService = {
      ensurePendingRequest: ensurePendingRequestMock,
      revokeStalePendingRequests: revokeStaleMock,
    } as unknown as RoleElevationRequestsService;

    service = new LdapAuthService(prisma, ldapClientService, ldapConfigsService, roleElevationRequestsService);
  });

  describe('listBootstrapUnits', () => {
    test('lists only active units with ldapEnabled=true', async () => {
      unitFindManyMock.mockResolvedValue([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);

      const result = await service.listBootstrapUnits();

      expect(unitFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ldapEnabled: true, isActive: true } }),
      );
      expect(result).toEqual([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);
    });
  });

  describe('authenticateExistingLdapUser', () => {
    const existingUser = {
      id: 'user-1',
      role: RoleName.ELABORADOR,
      ldapConfigId: 'cfg-1',
      ldapUsername: 'jsilva',
      authSource: AuthSource.LDAP,
    };

    test('throws generic UNAUTHORIZED when the bind fails', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue(null);

      await expect(service.authenticateExistingLdapUser(existingUser as never, 'senha-errada')).rejects.toMatchObject({
        response: 'Credenciais invalidas',
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    test('deactivates the user and denies login when the AD account is disabled', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: [], accountDisabled: true });

      await expect(service.authenticateExistingLdapUser(existingUser as never, 'senha')).rejects.toThrow(HttpException);
      expect(userUpdateMock).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { isActive: false } });
    });

    test('syncs the role from current groups and reactivates the user on success', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: ['CN=Revisores,DC=empresa,DC=local'], accountDisabled: false });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Revisores,DC=empresa,DC=local', role: RoleName.REVISOR }]);
      userUpdateMock.mockResolvedValue({
        id: 'user-1',
        matricula: 'ldap:unit-1:jsilva',
        nome: 'Joao',
        sobrenome: 'Silva',
        email: 'joao@empresa.local',
        role: RoleName.REVISOR,
        primaryUnitId: 'unit-1',
      });

      const result = await service.authenticateExistingLdapUser(existingUser as never, 'senha');

      expect(userUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' }, data: { role: RoleName.REVISOR, isActive: true } }),
      );
      expect(result.role).toBe(RoleName.REVISOR);
    });

    test('never downgrades an APROVADOR/ADMINISTRADOR role via group sync', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: ['CN=Observadores,DC=empresa,DC=local'], accountDisabled: false });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Observadores,DC=empresa,DC=local', role: RoleName.OBSERVADOR }]);
      userUpdateMock.mockResolvedValue({ id: 'user-1', role: RoleName.ADMINISTRADOR, primaryUnitId: 'unit-1' });

      await service.authenticateExistingLdapUser({ ...existingUser, role: RoleName.ADMINISTRADOR } as never, 'senha');

      expect(userUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: RoleName.ADMINISTRADOR, isActive: true } }),
      );
    });

    test('blocks login when the user has no valid O/E/R group', async () => {
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: [], accountDisabled: false });
      groupMappingFindManyMock.mockResolvedValue([]);

      await expect(service.authenticateExistingLdapUser(existingUser as never, 'senha')).rejects.toThrow(HttpException);
    });
  });

  describe('authenticateByDomain', () => {
    test('throws generic UNAUTHORIZED when no LdapConfig matches the domain', async () => {
      findActiveByDomainMock.mockResolvedValue(null);

      await expect(service.authenticateByDomain('EMPRESA', 'jsilva', 'senha')).rejects.toThrow(HttpException);
    });

    test('provisions a new user on first successful authentication', async () => {
      findActiveByDomainMock.mockResolvedValue({ id: 'cfg-1' });
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({
        userDn: 'CN=Joao Silva,DC=empresa,DC=local',
        nome: 'Joao',
        sobrenome: 'Silva',
        email: 'joao@empresa.local',
        groupDns: ['CN=Elaboradores,DC=empresa,DC=local'],
        accountDisabled: false,
      });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Elaboradores,DC=empresa,DC=local', role: RoleName.ELABORADOR }]);
      userCreateMock.mockResolvedValue({
        id: 'user-2',
        matricula: 'ldap:unit-1:jsilva',
        nome: 'Joao',
        sobrenome: 'Silva',
        email: 'joao@empresa.local',
        role: RoleName.ELABORADOR,
        primaryUnitId: 'unit-1',
      });

      const result = await service.authenticateByDomain('EMPRESA', 'jsilva', 'senha');

      expect(userCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authSource: AuthSource.LDAP,
            primaryUnitId: 'unit-1',
            ldapConfigId: 'cfg-1',
            ldapUsername: 'jsilva',
            role: RoleName.ELABORADOR,
          }),
        }),
      );
      expect(result.role).toBe(RoleName.ELABORADOR);
    });

    test('throws generic UNAUTHORIZED when the user has no O/E/R group on first login', async () => {
      findActiveByDomainMock.mockResolvedValue({ id: 'cfg-1' });
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue({ groupDns: [], accountDisabled: false, nome: 'Joao', sobrenome: 'Silva', email: 'joao@empresa.local' });
      groupMappingFindManyMock.mockResolvedValue([]);

      await expect(service.authenticateByDomain('EMPRESA', 'jsilva', 'senha')).rejects.toThrow(HttpException);
      expect(userCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('authenticateByUnit', () => {
    test('throws generic UNAUTHORIZED when every config of the unit fails', async () => {
      ldapConfigFindManyMock.mockResolvedValue([{ id: 'cfg-1' }, { id: 'cfg-2' }]);
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock.mockResolvedValue(null);

      await expect(service.authenticateByUnit('unit-1', 'jsilva', 'senha')).rejects.toThrow(HttpException);
    });

    test('provisions against the first config of the unit that authenticates successfully', async () => {
      ldapConfigFindManyMock.mockResolvedValue([{ id: 'cfg-1' }, { id: 'cfg-2' }]);
      getConnectionConfigMock.mockResolvedValue(connection);
      authenticateMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          userDn: 'CN=Joao Silva,DC=empresa,DC=local',
          nome: 'Joao',
          sobrenome: 'Silva',
          email: 'joao@empresa.local',
          groupDns: ['CN=Elaboradores,DC=empresa,DC=local'],
          accountDisabled: false,
        });
      groupMappingFindManyMock.mockResolvedValue([{ groupDn: 'CN=Elaboradores,DC=empresa,DC=local', role: RoleName.ELABORADOR }]);
      userCreateMock.mockResolvedValue({
        id: 'user-2',
        matricula: 'ldap:unit-1:jsilva',
        nome: 'Joao',
        sobrenome: 'Silva',
        email: 'joao@empresa.local',
        role: RoleName.ELABORADOR,
        primaryUnitId: 'unit-1',
      });

      const result = await service.authenticateByUnit('unit-1', 'jsilva', 'senha');

      expect(result.role).toBe(RoleName.ELABORADOR);
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd apps/api && npx jest ldap-auth.service.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `apps/api/src/ldap/ldap-auth.service.ts`:

```typescript
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AuthSource, RoleName, User } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LdapClientService } from './ldap-client.service';
import { LdapConfigsService } from './ldap-configs.service';
import { RoleElevationRequestsService } from './role-elevation-requests.service';
import { resolveRoleFromGroups } from './role-sync.util';

export interface BootstrapUnitOption {
  id: string;
  sigla: string;
  nome: string;
}

export class UnitSelectionRequiredException extends HttpException {
  constructor(units: BootstrapUnitOption[]) {
    super({ code: 'UNIT_SELECTION_REQUIRED', units }, HttpStatus.PRECONDITION_REQUIRED);
  }
}

const INVALID_CREDENTIALS_MESSAGE = 'Credenciais invalidas';

type UserWithUnit = User & { primaryUnit?: { id: string; sigla: string; nome: string } };

@Injectable()
export class LdapAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ldapClientService: LdapClientService,
    private readonly ldapConfigsService: LdapConfigsService,
    private readonly roleElevationRequestsService: RoleElevationRequestsService,
  ) {}

  async listBootstrapUnits(): Promise<BootstrapUnitOption[]> {
    return this.prisma.unit.findMany({
      where: { ldapEnabled: true, isActive: true },
      select: { id: true, sigla: true, nome: true },
      orderBy: { sigla: 'asc' },
    });
  }

  async authenticateExistingLdapUser(user: User, password: string): Promise<AuthenticatedUser> {
    if (!user.ldapConfigId || !user.ldapUsername) {
      this.denyGeneric();
    }

    const connection = await this.ldapConfigsService.getConnectionConfig(user.ldapConfigId as string);
    if (!connection) {
      this.denyGeneric();
    }

    const profile = await this.ldapClientService.authenticate(connection!, user.ldapUsername as string, password);
    if (!profile) {
      this.denyGeneric();
    }
    if (profile!.accountDisabled) {
      await this.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
      this.denyGeneric();
    }

    return this.syncGroupsAndReturnUser(user, connection!.id, profile!.groupDns);
  }

  async authenticateByDomain(domain: string, username: string, password: string): Promise<AuthenticatedUser> {
    const config = await this.ldapConfigsService.findActiveByDomain(domain);
    if (!config) {
      this.denyGeneric();
    }
    return this.authenticateAndProvision(config!.id, username, password);
  }

  async authenticateByUnit(unitId: string, username: string, password: string): Promise<AuthenticatedUser> {
    const configs = await this.prisma.ldapConfig.findMany({ where: { unitId, isActive: true } });
    for (const config of configs) {
      try {
        return await this.authenticateAndProvision(config.id, username, password);
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === HttpStatus.UNAUTHORIZED) {
          continue;
        }
        throw error;
      }
    }
    return this.denyGeneric();
  }

  private async authenticateAndProvision(ldapConfigId: string, username: string, password: string): Promise<AuthenticatedUser> {
    const connection = await this.ldapConfigsService.getConnectionConfig(ldapConfigId);
    if (!connection) {
      this.denyGeneric();
    }

    const profile = await this.ldapClientService.authenticate(connection!, username, password);
    if (!profile || profile.accountDisabled) {
      this.denyGeneric();
    }

    const mappings = await this.prisma.ldapGroupMapping.findMany({ where: { ldapConfigId } });
    const { autoRole } = resolveRoleFromGroups(profile!.groupDns, mappings);
    if (!autoRole) {
      this.denyGeneric();
    }

    const created = (await this.prisma.user.create({
      data: {
        matricula: this.buildProvisionedMatricula(connection!.unitId, username),
        nome: profile!.nome,
        sobrenome: profile!.sobrenome,
        email: profile!.email || this.buildFallbackEmail(username, connection!.unitId),
        role: autoRole as RoleName,
        primaryUnitId: connection!.unitId,
        authSource: AuthSource.LDAP,
        ldapConfigId,
        ldapUsername: username,
      },
      include: { primaryUnit: { select: { id: true, sigla: true, nome: true } } },
    })) as UserWithUnit;

    await this.applyElevationCandidates(created.id, profile!.groupDns, mappings);

    return this.toAuthenticatedUser(created);
  }

  private async syncGroupsAndReturnUser(user: User, ldapConfigId: string, groupDns: string[]): Promise<AuthenticatedUser> {
    const mappings = await this.prisma.ldapGroupMapping.findMany({ where: { ldapConfigId } });
    const { autoRole } = resolveRoleFromGroups(groupDns, mappings);
    if (!autoRole) {
      this.denyGeneric();
    }

    const nextRole = this.isElevatedRole(user.role) ? user.role : (autoRole as RoleName);
    const updated = (await this.prisma.user.update({
      where: { id: user.id },
      data: { role: nextRole, isActive: true },
      include: { primaryUnit: { select: { id: true, sigla: true, nome: true } } },
    })) as UserWithUnit;

    await this.applyElevationCandidates(user.id, groupDns, mappings);

    return this.toAuthenticatedUser(updated);
  }

  private async applyElevationCandidates(
    userId: string,
    groupDns: string[],
    mappings: { groupDn: string; role: RoleName }[],
  ): Promise<void> {
    const { elevationCandidates } = resolveRoleFromGroups(groupDns, mappings);
    const eligibleRoles = elevationCandidates.map((candidate) => candidate.role);
    for (const candidate of elevationCandidates) {
      await this.roleElevationRequestsService.ensurePendingRequest(userId, candidate.role, candidate.sourceGroupDn);
    }
    await this.roleElevationRequestsService.revokeStalePendingRequests(userId, eligibleRoles);
  }

  private isElevatedRole(role: RoleName): boolean {
    return role === RoleName.APROVADOR || role === RoleName.ADMINISTRADOR;
  }

  private buildProvisionedMatricula(unitId: string, username: string): string {
    return `ldap:${unitId}:${username}`;
  }

  private buildFallbackEmail(username: string, unitId: string): string {
    return `${username}@${unitId}.ldap.local`;
  }

  private toAuthenticatedUser(user: UserWithUnit): AuthenticatedUser {
    const { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit } = user;
    return { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit };
  }

  private denyGeneric(): never {
    throw new HttpException(INVALID_CREDENTIALS_MESSAGE, HttpStatus.UNAUTHORIZED);
  }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest ldap-auth.service.spec.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Exportar o serviço no módulo**

Edit `apps/api/src/ldap/ldap.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LdapAuthService } from './ldap-auth.service';
import { LdapClientService } from './ldap-client.service';
import { LdapConfigsController } from './ldap-configs.controller';
import { LdapConfigsService } from './ldap-configs.service';
import { LdapGroupMappingsController } from './ldap-group-mappings.controller';
import { LdapGroupMappingsService } from './ldap-group-mappings.service';
import { RoleElevationRequestsController } from './role-elevation-requests.controller';
import { RoleElevationRequestsService } from './role-elevation-requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LdapConfigsController, LdapGroupMappingsController, RoleElevationRequestsController],
  providers: [
    LdapClientService,
    LdapConfigsService,
    LdapGroupMappingsService,
    RoleElevationRequestsService,
    LdapAuthService,
  ],
  exports: [LdapAuthService],
})
export class LdapModule {}
```

- [ ] **Step 6: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/ldap/ldap-auth.service.ts apps/api/src/ldap/ldap-auth.service.spec.ts apps/api/src/ldap/ldap.module.ts
git commit -m "feat(ldap): adiciona LdapAuthService (orquestra bootstrap, provisionamento e sync de grupos no login)"
```

---

## Task 12: Integração com o fluxo de login (`AuthModule`)

**Files:**
- Modify: `apps/api/src/auth/dto/login.dto.ts`
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/users.service.spec.ts` (já existe e está com bug pré-existente — corrigir e estender, não recriar do zero)
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.controller.spec.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

**Interfaces:**
- Consumes: `LdapAuthService` (Task 11), `parseDomainQualifiedIdentifier` (Task 4).
- Produces: `AuthService.authenticate(dto: LoginDto): Promise<AuthenticatedUser>` (substitui o antigo `validateCredentials` como ponto de entrada do controller), `GET /auth/ldap-units`.

- [ ] **Step 1: Atualizar `LoginDto`**

Edit `apps/api/src/auth/dto/login.dto.ts`:

```typescript
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string; // matricula, e-mail, ou usuario de dominio (DOMINIO\usuario / usuario@dominio)

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}
```

- [ ] **Step 2: Estender `UsersService.findActiveByIdentifier` para também casar por `ldapUsername` — teste primeiro (RED)**

`apps/api/src/users/users.service.spec.ts` **já existe**, mas está desatualizado em relação à implementação real: `UsersService.findActiveByIdentifier`/`.findActiveById` já fazem `include: { primaryUnit: {...} }` (ver `apps/api/src/users/users.service.ts`), mas os dois testes atuais não esperam esse `include` — por isso ambos já falham no baseline, antes de qualquer mudança de LDAP. Substitua o conteúdo do arquivo por esta versão, que corrige o `include` faltante nos dois testes existentes e estende o primeiro para cobrir `ldapUsername`:

```typescript
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let findFirstMock: jest.Mock;

  beforeEach(() => {
    findFirstMock = jest.fn();
    const prisma = { user: { findFirst: findFirstMock } } as unknown as PrismaService;
    service = new UsersService(prisma);
  });

  test('findActiveByIdentifier matches by matricula, email or ldapUsername, scoped to active users only', async () => {
    await service.findActiveByIdentifier('jsilva');

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { isActive: true, OR: [{ matricula: 'jsilva' }, { email: 'jsilva' }, { ldapUsername: 'jsilva' }] },
      include: { primaryUnit: { select: { id: true, sigla: true, nome: true } } },
    });
  });

  test('findActiveById matches by id, scoped to active users only', async () => {
    await service.findActiveById('user-1');

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: 'user-1', isActive: true },
      include: { primaryUnit: { select: { id: true, sigla: true, nome: true } } },
    });
  });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `cd apps/api && npx jest users.service.spec.ts`
Expected: `findActiveById` PASSA (a implementação já faz o `include`, só o teste estava desatualizado). `findActiveByIdentifier` FALHA — o `OR` real ainda não inclui `ldapUsername`. Se `findActiveById` também falhar, a implementação mudou além do esperado — pare e reporte.

- [ ] **Step 4: Implementar**

Edit `apps/api/src/users/users.service.ts`, no método `findActiveByIdentifier`:

```typescript
findActiveByIdentifier(identifier: string) {
  return this.prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [{ matricula: identifier }, { email: identifier }, { ldapUsername: identifier }],
    },
    include: {
      primaryUnit: {
        select: { id: true, sigla: true, nome: true },
      },
    },
  });
}
```

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest users.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Reescrever `AuthService` — teste primeiro (RED)**

Edit `apps/api/src/auth/auth.service.spec.ts` (substitui o conteúdo inteiro):

```typescript
import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthSource, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LdapAuthService, UnitSelectionRequiredException } from '../ldap/ldap-auth.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
const compareMock = bcrypt.compare as unknown as jest.Mock;

describe('AuthService', () => {
  let service: AuthService;
  let findActiveByIdentifierMock: jest.Mock;
  let signMock: jest.Mock;
  let authenticateExistingLdapUserMock: jest.Mock;
  let authenticateByDomainMock: jest.Mock;
  let authenticateByUnitMock: jest.Mock;
  let listBootstrapUnitsMock: jest.Mock;

  const localUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Teste',
    sobrenome: 'Usuario',
    email: 'teste@formops.local',
    passwordHash: 'hashed-password',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
    authSource: AuthSource.LOCAL,
  };

  const ldapUser = { ...localUser, id: 'user-2', authSource: AuthSource.LDAP, passwordHash: null };

  beforeEach(() => {
    findActiveByIdentifierMock = jest.fn();
    signMock = jest.fn().mockReturnValue('signed-jwt');
    authenticateExistingLdapUserMock = jest.fn();
    authenticateByDomainMock = jest.fn();
    authenticateByUnitMock = jest.fn();
    listBootstrapUnitsMock = jest.fn().mockResolvedValue([]);

    const usersService = { findActiveByIdentifier: findActiveByIdentifierMock } as unknown as UsersService;
    const jwtService = { sign: signMock } as unknown as JwtService;
    const ldapAuthService = {
      authenticateExistingLdapUser: authenticateExistingLdapUserMock,
      authenticateByDomain: authenticateByDomainMock,
      authenticateByUnit: authenticateByUnitMock,
      listBootstrapUnits: listBootstrapUnitsMock,
    } as unknown as LdapAuthService;

    service = new AuthService(usersService, jwtService, ldapAuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('authenticate — usuario local existente', () => {
    test('throws UnauthorizedException when the password does not match', async () => {
      findActiveByIdentifierMock.mockResolvedValue(localUser);
      compareMock.mockResolvedValue(false);

      await expect(service.authenticate({ identifier: '10001', password: 'errada' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    test('returns the authenticated user on valid local credentials', async () => {
      findActiveByIdentifierMock.mockResolvedValue(localUser);
      compareMock.mockResolvedValue(true);

      const result = await service.authenticate({ identifier: '10001', password: 'correta' });

      expect(result.id).toBe('user-1');
      expect(authenticateExistingLdapUserMock).not.toHaveBeenCalled();
    });
  });

  describe('authenticate — usuario LDAP ja provisionado', () => {
    test('delegates to LdapAuthService.authenticateExistingLdapUser, never trying other configs', async () => {
      findActiveByIdentifierMock.mockResolvedValue(ldapUser);
      authenticateExistingLdapUserMock.mockResolvedValue({ id: 'user-2' });

      await service.authenticate({ identifier: 'jsilva', password: 'senha' });

      expect(authenticateExistingLdapUserMock).toHaveBeenCalledWith(ldapUser, 'senha');
      expect(authenticateByDomainMock).not.toHaveBeenCalled();
      expect(authenticateByUnitMock).not.toHaveBeenCalled();
    });
  });

  describe('authenticate — identifier com dominio, usuario ainda nao provisionado', () => {
    test('delegates to LdapAuthService.authenticateByDomain', async () => {
      findActiveByIdentifierMock.mockResolvedValue(null);
      authenticateByDomainMock.mockResolvedValue({ id: 'user-3' });

      await service.authenticate({ identifier: 'EMPRESA\\jsilva', password: 'senha' });

      expect(authenticateByDomainMock).toHaveBeenCalledWith('EMPRESA', 'jsilva', 'senha');
    });
  });

  describe('authenticate — usuario nao encontrado, sem dominio, sem unitId', () => {
    test('throws UnitSelectionRequiredException with the bootstrap unit list', async () => {
      findActiveByIdentifierMock.mockResolvedValue(null);
      listBootstrapUnitsMock.mockResolvedValue([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);

      await expect(service.authenticate({ identifier: 'jsilva', password: 'senha' })).rejects.toBeInstanceOf(
        UnitSelectionRequiredException,
      );
    });
  });

  describe('authenticate — usuario nao encontrado, sem dominio, com unitId', () => {
    test('delegates to LdapAuthService.authenticateByUnit', async () => {
      findActiveByIdentifierMock.mockResolvedValue(null);
      authenticateByUnitMock.mockResolvedValue({ id: 'user-4' });

      await service.authenticate({ identifier: 'jsilva', password: 'senha', unitId: 'unit-1' });

      expect(authenticateByUnitMock).toHaveBeenCalledWith('unit-1', 'jsilva', 'senha');
    });
  });

  describe('login', () => {
    test('signs a JWT payload with sub/role/unitId and returns it alongside the user', () => {
      const user = {
        id: localUser.id,
        matricula: localUser.matricula,
        nome: localUser.nome,
        sobrenome: localUser.sobrenome,
        email: localUser.email,
        role: localUser.role,
        primaryUnitId: localUser.primaryUnitId,
      };

      const result = service.login(user);

      expect(signMock).toHaveBeenCalledWith({ sub: user.id, role: user.role, unitId: user.primaryUnitId });
      expect(result).toEqual({ accessToken: 'signed-jwt', user });
    });
  });
});
```

- [ ] **Step 7: Rodar e confirmar falha**

Run: `cd apps/api && npx jest auth.service.spec.ts`
Expected: FAIL — `AuthService.authenticate` não existe / construtor não aceita `LdapAuthService`.

- [ ] **Step 8: Implementar**

Edit `apps/api/src/auth/auth.service.ts` (substitui o conteúdo inteiro):

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthSource } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LdapAuthService, UnitSelectionRequiredException } from '../ldap/ldap-auth.service';
import { parseDomainQualifiedIdentifier } from '../ldap/ldap-identifier.util';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { JwtPayload } from './types/jwt-payload.interface';

type LocalUserRecord = NonNullable<Awaited<ReturnType<UsersService['findActiveByIdentifier']>>>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly ldapAuthService: LdapAuthService,
  ) {}

  async authenticate(dto: LoginDto): Promise<AuthenticatedUser> {
    const existingUser = await this.usersService.findActiveByIdentifier(dto.identifier);

    if (existingUser && existingUser.authSource === AuthSource.LOCAL) {
      return this.validateLocalCredentials(existingUser, dto.password);
    }

    if (existingUser && existingUser.authSource === AuthSource.LDAP) {
      return this.ldapAuthService.authenticateExistingLdapUser(existingUser, dto.password);
    }

    const domainMatch = parseDomainQualifiedIdentifier(dto.identifier);
    if (domainMatch) {
      return this.ldapAuthService.authenticateByDomain(domainMatch.domain, domainMatch.username, dto.password);
    }

    if (!dto.unitId) {
      throw new UnitSelectionRequiredException(await this.ldapAuthService.listBootstrapUnits());
    }

    return this.ldapAuthService.authenticateByUnit(dto.unitId, dto.identifier, dto.password);
  }

  login(user: AuthenticatedUser) {
    const payload: JwtPayload = { sub: user.id, role: user.role, unitId: user.primaryUnitId };
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }

  private async validateLocalCredentials(user: LocalUserRecord, password: string): Promise<AuthenticatedUser> {
    if (!user.passwordHash) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.toAuthenticatedUser(user);
  }

  private toAuthenticatedUser(user: LocalUserRecord): AuthenticatedUser {
    const { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit } = user;
    return { id, matricula, nome, sobrenome, email, role, primaryUnitId, primaryUnit };
  }
}
```

- [ ] **Step 9: Rodar e confirmar sucesso**

Run: `cd apps/api && npx jest auth.service.spec.ts`
Expected: PASS (8 testes).

- [ ] **Step 10: Atualizar `AuthController` e seu teste**

Edit `apps/api/src/auth/auth.controller.spec.ts` (substitui o conteúdo inteiro):

```typescript
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LdapAuthService } from '../ldap/ldap-auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authenticateMock: jest.Mock;
  let loginMock: jest.Mock;
  let listBootstrapUnitsMock: jest.Mock;

  beforeEach(() => {
    authenticateMock = jest.fn().mockResolvedValue({ id: 'user-1' });
    loginMock = jest.fn().mockReturnValue({ accessToken: 'token', user: { id: 'user-1' } });
    listBootstrapUnitsMock = jest.fn().mockResolvedValue([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);

    const authService = { authenticate: authenticateMock, login: loginMock } as unknown as AuthService;
    const ldapAuthService = { listBootstrapUnits: listBootstrapUnitsMock } as unknown as LdapAuthService;

    controller = new AuthController(authService, ldapAuthService);
  });

  test('login authenticates then signs the JWT', async () => {
    const dto = { identifier: '10001', password: 'senha' };

    const result = await controller.login(dto);

    expect(authenticateMock).toHaveBeenCalledWith(dto);
    expect(loginMock).toHaveBeenCalledWith({ id: 'user-1' });
    expect(result).toEqual({ accessToken: 'token', user: { id: 'user-1' } });
  });

  test('ldapUnits delegates to LdapAuthService.listBootstrapUnits', async () => {
    const result = await controller.ldapUnits();

    expect(listBootstrapUnitsMock).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);
  });
});
```

Run: `cd apps/api && npx jest auth.controller.spec.ts`
Expected: FAIL — `AuthController` ainda não tem `ldapUnits` nem aceita `LdapAuthService`.

Edit `apps/api/src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { LdapAuthService } from '../ldap/ldap-auth.service';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly ldapAuthService: LdapAuthService,
  ) {}

  // Limite mais estrito que o default global (Fase 12 — achado HIGH: login
  // sem rate limiting permitia forca bruta/credential stuffing).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.authenticate(dto);
    return this.authService.login(user);
  }

  // Metadados nao sensiveis (id/sigla/nome das unidades com LDAP habilitado)
  // usados pelo popup de selecao de unidade no primeiro login de um usuario
  // ainda nao provisionado. Throttle mais permissivo que /login por nao
  // expor nenhum dado de credencial.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Public()
  @Get('ldap-units')
  ldapUnits() {
    return this.ldapAuthService.listBootstrapUnits();
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
```

Run: `cd apps/api && npx jest auth.controller.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 11: Importar `LdapModule` no `AuthModule`**

Edit `apps/api/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { LdapModule } from '../ldap/ldap.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    LdapModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

- [ ] **Step 12: Rodar a suíte completa do módulo auth + ldap + users**

Run: `cd apps/api && npx jest src/auth src/ldap src/users`
Expected: PASS em todos os arquivos.

- [ ] **Step 13: Commit**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/auth apps/api/src/users apps/api/src/ldap/ldap.module.ts
git commit -m "feat(ldap): integra fluxo de login local/LDAP em AuthService e AuthController"
```

---

## Task 13: Registro no `AppModule`, suíte completa e push

**Files:**
- Modify: `apps/api/src/app.module.ts`

**Interfaces:** nenhuma nova — task de integração final.

- [ ] **Step 1: Registrar o `LdapModule` no `AppModule`**

Edit `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CommonModule } from './common/common.module';
import { EvidenceModule } from './evidence/evidence.module';
import { ExportModule } from './export/export.module';
import { FormsModule } from './forms/forms.module';
import { HealthController } from './health/health.controller';
import { LdapModule } from './ldap/ldap.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { ValidationModule } from './validation/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    CommonModule,
    UsersModule,
    AuthModule,
    AdminModule,
    LdapModule,
    FormsModule,
    LifecycleModule,
    ReportsModule,
    EvidenceModule,
    ValidationModule,
    ExportModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Rodar a suíte completa do backend**

Run: `cd apps/api && npm test`
Expected: PASS em todos os testes novos e nos que já passavam no baseline (nenhuma regressão nos módulos que dependiam de `AuthService`/`UsersService`). Exceção conhecida, fora de escopo: `src/lifecycle/report-lifecycle.service.spec.ts` já falhava antes da Task 1 (ver Global Constraints) e continua falhando — não é uma regressão desta feature.

- [ ] **Step 3: Rodar a cobertura e validar ≥ 80% nos arquivos novos**

Run: `cd apps/api && npm run test:cov -- --collectCoverageFrom="src/ldap/**/*.ts" --collectCoverageFrom="!src/ldap/**/*.spec.ts"`
Expected: cobertura ≥ 80% em statements/branches/functions/lines para `src/ldap/**`.

- [ ] **Step 4: Rodar o lint**

Run: `cd apps/api && npm run lint`
Expected: sem erros nos arquivos novos/modificados.

- [ ] **Step 5: Verificar que o build compila**

Run: `cd apps/api && npm run build`
Expected: build concluído sem erros de TypeScript.

- [ ] **Step 6: Commit final**

```bash
cd /home/admin/indicadores-de-ti
git add apps/api/src/app.module.ts
git commit -m "feat(ldap): registra LdapModule no AppModule"
```

- [ ] **Step 7: Push**

```bash
git push
```
Expected: todos os commits das Tasks 1–13 enviados para o remoto.

---

## Validation (resumo — rodar ao final de tudo)

```bash
cd apps/api
npm run prisma:generate
npm test
npm run lint
npm run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `ldapts` ter uma API ligeiramente diferente da assumida (`Client`, `.bind`, `.search`, `.unbind`) | Média | `LdapClientService` isola toda a superfície de `ldapts` num único arquivo — se a API real divergir, o ajuste fica contido ali e nos mocks do spec da Task 7 |
| Ambiente de execução sem um Postgres acessível para rodar as migrations da Task 1 | Média | Documentar isso ao usuário antes de iniciar; sem banco, as migrations não podem ser aplicadas e as Tasks seguintes (que dependem dos tipos gerados pelo Prisma Client) ficam bloqueadas |
| `matricula` sintética (`ldap:<unitId>:<username>`) para usuários provisionados via LDAP colidir com alguma convenção futura de matrícula real | Baixa | Formato usa um prefixo `ldap:` que nunca colide com matrículas numéricas existentes; documentado como decisão de implementação no código |
| `LDAP_CONFIG_ENCRYPTION_KEY` ausente/mal formatada em produção | Média | `env.validation.ts` falha rápido na inicialização (Task 2); `parseLdapEncryptionKey` valida o tamanho decodificado (Task 3) |

## Acceptance

- [ ] Todas as 13 tasks completas com commits individuais
- [ ] `npm test`, `npm run lint` e `npm run build` passam em `apps/api`
- [ ] Cobertura ≥ 80% em `src/ldap/**`
- [ ] Nenhuma mudança em `apps/web`
- [ ] Push final enviado ao remoto
