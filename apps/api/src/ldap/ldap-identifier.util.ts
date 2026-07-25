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
