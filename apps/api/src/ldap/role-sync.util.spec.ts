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
