import { brand } from '../config/brand';

// T155/contracts/analytics-layer.md: destino do redirecionamento do resolver
// de evidencia (GET /analytics/evidence/:token) quando o token e invalido,
// expirado ou ja consumido — as tres situacoes chegam aqui identicas
// (US8-6, US8-8), nunca como erro cru de servidor. Rota publica, fora do
// guard de sessao (quem clica vem de um painel de BI, sem login).
export function EvidenceExpiredPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{brand.departmentAcronym}</p>

      <div className="w-full rounded-lg border-2 border-status-aprovacao/30 bg-status-aprovacao/10 px-6 py-8">
        <h1 className="text-lg font-semibold text-status-aprovacao">Vínculo de evidência expirado</h1>
        <p className="mt-2 text-sm text-ink">
          Este vínculo já foi utilizado ou não é mais válido. Por segurança, cada vínculo de evidência funciona uma
          única vez e por tempo limitado.
        </p>
      </div>

      <p className="text-sm text-ink-muted">
        Se você chegou até aqui a partir de um painel de BI, atualize o painel para gerar um novo vínculo — a
        próxima recarga da camada analítica renova automaticamente o acesso a este arquivo.
      </p>
    </div>
  );
}
