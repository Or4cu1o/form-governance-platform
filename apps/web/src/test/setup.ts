import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);

// A partir do Node 26, `globalThis.localStorage` ja existe nativamente, mas
// fica `undefined` sem a flag `--localstorage-file`. O Vitest, por sua vez,
// nao sobrescreve chaves ja presentes no global do Node com a implementacao
// do jsdom (ver vitest/dist/chunks: populateGlobal so substitui chaves fora
// da lista estatica quando elas ainda nao existem no global). Resultado:
// testes que usam `localStorage` quebram mesmo com environment: 'jsdom'.
// Instala a implementacao real do jsdom por cima do global nativo quebrado.
const jsdomInstance = (globalThis as { jsdom?: { window: Window } }).jsdom;
if (jsdomInstance) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdomInstance.window.localStorage,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
});
