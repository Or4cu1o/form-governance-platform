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
