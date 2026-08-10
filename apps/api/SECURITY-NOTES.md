# Notas de Segurança — Riscos Aceitos

Registrado na Fase 12 (revisão de código/segurança) do plano de implementação. Decisão do responsável pelo projeto: aceitar os dois riscos abaixo por ora, sem bloquear o fechamento da fase, dado que as mitigações de código equivalentes já foram aplicadas.

## 1. `nodemailer` com CVEs HIGH (versão atual: `^6.9.16`)

`npm audit` reporta múltiplas CVEs HIGH na faixa `<=9.0.0`, entre elas:

- CRLF/SMTP header injection (GHSA-268h-hp4c-crq3, GHSA-vvjj-xcjg-gr5g)
- SMTP command injection via `envelope.size` (GHSA-c7w3-x93f-qmm8)
- SSRF / leitura arbitrária de arquivo via opção `raw` (GHSA-p6gq-j5cr-w38f)

**Correção completa:** `nodemailer@>=9.0.1` — é um upgrade de versão major (6→9), com mudanças de API que exigiriam validação manual do fluxo de envio.

**Mitigação já aplicada no código** (`src/notifications/email-templates.util.ts`): `sanitizeHeaderValue()` remove `\r\n` de `unit.sigla` antes de compor o `subject`, e `escapeHtml()` escapa `unit.sigla`/`unit.nome` no corpo HTML. Isso neutraliza o vetor de injeção mais provável no código da aplicação (dado de unidade cadastrado pelo Administrador), mas não elimina as vulnerabilidades internas da biblioteca.

**Quando revisitar:** antes de expor o envio de e-mail a qualquer entrada não controlada pela aplicação, ou na próxima janela de manutenção de dependências.

**Reavaliação (T163, Fase 11):** sem mudança de superfície — a quarentena antivírus e a verificação de assinatura binária (abaixo) protegem o pipeline de **evidências**, um fluxo sem relação com o envio de e-mail. O risco aceito e o plano de correção continuam os mesmos.

## 2. `multer` com CVEs HIGH (via `@nestjs/platform-express@^10.4.15`)

4 CVEs HIGH de negação de serviço: limpeza incompleta de upload, exaustão de recursos, recursão descontrolada em nomes de campo, limpeza incompleta de uploads abortados.

**Correção completa:** exige `@nestjs/platform-express@11.1.28`, que por sua vez exige subir `@nestjs/core` e `@nestjs/common` para a mesma major (10→11) — um upgrade de framework inteiro, não um patch isolado.

**Mitigação já aplicada no código:**
- `MAX_EVIDENCE_UPLOAD_BYTES` (10 MB) limita o tamanho de cada upload (`src/common/evidence-upload.constants.ts`).
- `EVIDENCE_MIME_TYPE_FILTER` restringe uploads de evidência a `application/pdf`, `image/png`, `image/jpeg`, `image/webp` — reduz a superfície de ataque mesmo que o parser tenha bugs de DoS.

**Quando revisitar:** junto com o upgrade do NestJS 10→11 (recomendado tratar como projeto próprio, com testes de regressão completos, não como parte de uma correção pontual de segurança).

**Reavaliação (T163, Fase 11):** duas camadas novas reduzem o risco residual, sem eliminar as CVEs da biblioteca em si (elas afetam o parsing do `multipart/form-data` propriamente dito, que já ocorreu antes de qualquer verificação subsequente rodar):
- **Verificação de assinatura binária** (`assertEvidenceFileSignatureMatches`, T168, `src/common/evidence-upload.constants.ts`): rejeita, com `BadRequestException` e nada gravado, qualquer arquivo cujos bytes iniciais não correspondam à assinatura real do tipo declarado — fecha o vetor de MIME forjado que a whitelist por header sozinha não cobria.
- **Quarentena com verificação antivírus** (`AntivirusService`, T050): todo upload aterrissa isolado e passa por ClamAV antes de qualquer promoção ao acervo imutável; um arquivo malicioso que sobrevivesse a um bug de DoS do `multer` ainda enfrentaria essa barreira antes de alcançar o restante da plataforma.

Avaliação: o risco aceito permanece — nenhuma das duas camadas corrige os CVEs de exaustão de recursos do `multer` em si, que atuam durante o parsing, antes dessas verificações. O plano de correção (upgrade de framework) não muda.

## Achados já corrigidos nesta mesma revisão (não listados aqui como risco)

- Rate limiting ausente em `POST /auth/login` → `@nestjs/throttler` (5 tentativas / 60s no login; 20/60s global).
- Upload sem whitelist de tipo de arquivo → `EVIDENCE_MIME_TYPE_FILTER`.
- CORS aberto (`Access-Control-Allow-Origin: *`) → restringível via `CORS_ORIGIN` (ver `.env.example`).
- CSV/Excel formula injection na exportação → prefixo de apóstrofo em células iniciadas com `=+-@`.
- HTML injection em e-mails via `unit.sigla`/`unit.nome` → escaping de entidades HTML.
- Ausência de security headers → `helmet()` adicionado ao bootstrap.
