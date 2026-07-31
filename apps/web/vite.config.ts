import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// O .env do monorepo fica na raiz (dois niveis acima de apps/web), nao em
// apps/web/.env. Le so a linha WEB_PORT diretamente do arquivo em vez de usar
// o loadEnv() do Vite, que carrega o NODE_ENV do .env junto e sobrescreve o
// modo de build (gera bundle de producao nao minificado).
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// O .env do monorepo fica na raiz (dois niveis acima de apps/web), nao em
// apps/web/.env. Le so a linha WEB_PORT diretamente do arquivo em vez de usar
// o loadEnv() do Vite, que carrega o NODE_ENV do .env junto e sobrescreve o
// modo de build (gera bundle de producao nao minificado).
interface RootEnv {
  webPort: number | undefined;
  enableHttps: boolean;
  sslKeyPath: string | undefined;
  sslCertPath: string | undefined;
  viteVars: Record<string, string>;
}

function readRootEnv(): RootEnv {
  try {
    const content = readFileSync(new URL('../../.env', import.meta.url), 'utf-8');
    const viteVars: Record<string, string> = {};
    let webPort: number | undefined;
    let apiPort: string | undefined;
    let enableHttps = false;
    let sslKeyPath: string | undefined;
    let sslCertPath: string | undefined;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      // Ignorar comentarios e linhas vazias
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();

      if (key === 'WEB_PORT') {
        const n = Number(val);
        if (!isNaN(n)) webPort = n;
      } else if (key === 'API_PORT') {
        apiPort = val;
      } else if (key === 'ENABLE_HTTPS') {
        enableHttps = val === 'true';
      } else if (key === 'SSL_KEY_PATH') {
        sslKeyPath = val;
      } else if (key === 'SSL_CERT_PATH') {
        sslCertPath = val;
      }
      // Injeta todas as variaveis VITE_* no bundle via import.meta.env
      if (key.startsWith('VITE_')) {
        viteVars[key] = val;
      }
    }
    // VITE_API_URL e derivada de API_PORT, a menos que ja venha explicita no .env
    if (!viteVars.VITE_API_URL) {
      viteVars.VITE_API_URL = `http://localhost:${apiPort ?? 3000}`;
    }
    return { webPort, enableHttps, sslKeyPath, sslCertPath, viteVars };
  } catch {
    return { webPort: undefined, enableHttps: false, sslKeyPath: undefined, sslCertPath: undefined, viteVars: {} };
  }
}

const { webPort, enableHttps, sslKeyPath, sslCertPath, viteVars } = readRootEnv();

// Transforma {VITE_API_URL: 'http://...'} em {'import.meta.env.VITE_API_URL': '"http://..."'}
// para que o Vite substitua estaticamente nos bundles
const defineEnv = Object.fromEntries(
  Object.entries(viteVars).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
);

const resolveRootPath = (p: string) => {
  if (isAbsolute(p)) return p;
  const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
  return resolve(projectRoot, p);
};

const httpsConfig = enableHttps && sslKeyPath && sslCertPath ? {
  key: readFileSync(resolveRootPath(sslKeyPath)),
  cert: readFileSync(resolveRootPath(sslCertPath)),
} : undefined;

export default defineConfig({
  plugins: [react()],
  define: defineEnv,
  server: {
    host: true,
    port: webPort ?? 3001,
    https: httpsConfig,
    // Permite acesso via tunel Cloudflare (*.trycloudflare.com), cujo
    // subdominio muda a cada reinicio do tunel — nao da para fixar um host.
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    host: true,
    port: webPort ?? 4173,
    https: httpsConfig,
    allowedHosts: ['.trycloudflare.com'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/types/**'],
    },
  },
});
