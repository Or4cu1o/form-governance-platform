// Escaping RFC 4515 para valores interpolados em filtros LDAP — sem isso,
// um username como "*)(uid=*))(|(uid=*" poderia alterar a logica do filtro
// de busca (LDAP injection). Os unicos caracteres que a RFC exige escapar
// sao barra invertida, asterisco, parenteses e o byte NUL — espaco e valido
// dentro de um valor e NAO deve ser escapado (nao confundir com o escape \00,
// que representa o byte NUL literal, nao o caractere espaco).
const ESCAPE_MAP: Record<string, string> = {
  '\\': '\\5c',
  '*': '\\2a',
  '(': '\\28',
  ')': '\\29',
  '\0': '\\00',
};

export function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (char) => ESCAPE_MAP[char]);
}
