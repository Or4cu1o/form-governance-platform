import { escapeLdapFilterValue } from './ldap-filter.util';

describe('escapeLdapFilterValue', () => {
  test('escapes backslash, asterisk and parentheses per RFC 4515', () => {
    expect(escapeLdapFilterValue('a\\b*c(d)e f')).toBe('a\\5cb\\2ac\\28d\\29e f');
  });

  test('escapes a NUL byte per RFC 4515', () => {
    expect(escapeLdapFilterValue('a\0b')).toBe('a\\00b');
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
