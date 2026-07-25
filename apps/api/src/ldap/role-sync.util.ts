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
