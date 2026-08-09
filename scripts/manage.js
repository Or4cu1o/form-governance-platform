const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const net = require('net');

// Cores ANSI universais
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const ROOT_DIR = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT_DIR, '.formops.pid');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const ENV_FILE = path.join(ROOT_DIR, '.env');

// Desativar a limpeza de tela do CLI do Vite
process.env.VITE_CLI_CONFIG_CLEAR_SCREEN = 'false';

// Carregar variáveis do .env
function loadEnv() {
  if (!fs.existsSync(ENV_FILE) && fs.existsSync(path.join(ROOT_DIR, '.env.example'))) {
    fs.copyFileSync(path.join(ROOT_DIR, '.env.example'), ENV_FILE);
    console.log(`${GREEN}✓ Arquivo .env criado a partir de .env.example.${RESET}`);
  }

  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }

  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.API_PORT = process.env.API_PORT || '3000';
  process.env.WEB_PORT = process.env.WEB_PORT || '3001';
  process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
  process.env.MINIO_API_PORT = process.env.MINIO_API_PORT || '9000';
  process.env.CLAMAV_PORT = process.env.CLAMAV_PORT || '3310';
  process.env.CLAMAV_HOST = process.env.CLAMAV_HOST || 'localhost';
  // VITE_API_URL, DATABASE_URL e S3_ENDPOINT sao derivadas em vez de mantidas separadas, evitando desalinhamento
  process.env.VITE_API_URL = process.env.VITE_API_URL || `http://localhost:${process.env.API_PORT}`;
  process.env.DATABASE_URL = process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
  process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || `http://localhost:${process.env.MINIO_API_PORT}`;
  // CORS_ORIGIN (T171) e obrigatoria no boot da API (env.validation.ts) — cai
  // aqui para um .env pre-existente que ainda nao tem a linha.
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:${process.env.WEB_PORT}`;
}

loadEnv();

// Helper para executar comandos
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, stdio: opts.silent ? 'ignore' : 'inherit', ...opts });
  } catch (err) {
    if (opts.ignoreError) return null;
    throw err;
  }
}

function runOut(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function detectDockerCompose() {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch {
    try {
      execSync('docker-compose version', { stdio: 'ignore' });
      return 'docker-compose';
    } catch {
      return null;
    }
  }
}

const DOCKER_COMPOSE = detectDockerCompose();

// Verificar se um PID está vivo
function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

// Obter PIDs salvos em .formops.pid
function getSavedPids() {
  if (!fs.existsSync(PID_FILE)) return { api: null, web: null };
  const content = fs.readFileSync(PID_FILE, 'utf-8');
  let api = null, web = null;
  content.split('\n').forEach(line => {
    if (line.startsWith('SAVED_API_PID=')) api = line.split('=')[1].trim();
    if (line.startsWith('SAVED_WEB_PID=')) web = line.split('=')[1].trim();
  });
  return { api, web };
}

function savePids(api, web) {
  fs.writeFileSync(PID_FILE, `SAVED_API_PID=${api}\nSAVED_WEB_PID=${web}\n`);
}

function removePidFile() {
  if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
}

// Verificar ocupação de portas
function checkPort(port) {
  return new Promise(resolve => {
    const tester = net.createServer()
      .once('error', err => {
        if (err.code === 'EADDRINUSE') {
          const pid = runOut(`lsof -ti :${port} | head -n 1`) || runOut(`fuser ${port}/tcp 2>/dev/null | awk '{print $1}'`);
          resolve({ inUse: true, pid: pid || null });
        } else {
          resolve({ inUse: false });
        }
      })
      .once('listening', () => {
        tester.once('close', () => resolve({ inUse: false })).close();
      })
      .listen(Number(port), '0.0.0.0');
  });
}

function isFormOpsPid(pid) {
  if (!pid) return false;
  const savedPids = getSavedPids();
  if (savedPids.api === String(pid) || savedPids.web === String(pid)) return true;

  const args = runOut(`ps -o args= -p ${pid}`);
  if (/indicadores-de-ti|formops|apps\/api|apps\/web|vite|nest|ts-node/i.test(args)) return true;

  const cwd = runOut(`readlink -f /proc/${pid}/cwd`);
  if (cwd && cwd.includes(ROOT_DIR)) return true;

  return false;
}

// Exibir status dos containers Docker
function printDockerStatus() {
  if (!DOCKER_COMPOSE) return;
  console.log(`\n${CYAN}Status dos containers Docker:${RESET}`);
  const status = runOut(`${DOCKER_COMPOSE} ps --format "  - {{.Service}} ({{.Name}}): {{.Status}}"`);
  if (status) {
    status.split('\n').forEach(line => {
      if (!line.trim()) return;
      let l = line.replace('(healthy)', `(${GREEN}healthy${RESET})`);
      l = l.replace('(unhealthy)', `(${RED}unhealthy${RESET})`);
      console.log(l);
    });
  } else {
    run(`${DOCKER_COMPOSE} ps`, { ignoreError: true });
  }
}

// Exibir credenciais e usuários
function printUserList() {
  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}                     Credenciais e Usuários de Acesso                 ${RESET}`);
  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}Administrador Inicial (provisionado via .env):${RESET}`);
  console.log(`  - Matrícula: ${GREEN}${process.env.INITIAL_ADMIN_MATRICULA || '00001'}${RESET}`);
  console.log(`  - E-mail:    ${GREEN}${process.env.INITIAL_ADMIN_EMAIL || 'admin@agirsaude.org.br'}${RESET}`);
  console.log(`  - Senha:     ${YELLOW}${process.env.INITIAL_ADMIN_PASSWORD || 'Agir@2026'}${RESET}`);

  const envLower = (process.env.NODE_ENV || 'development').toLowerCase();
  if (envLower !== 'production' && envLower !== 'prod') {
    console.log(`\n${BOLD}Usuários de Teste para Desenvolvimento (Senha padrão: ${YELLOW}FormOpsTeste@2026${RESET}):${RESET}`);
    console.log(`  - ${MAGENTA}Observador${RESET}:    email: ${GREEN}observador@matriz.dev${RESET}    | matrícula: ${GREEN}10001${RESET}`);
    console.log(`  - ${MAGENTA}Elaborador${RESET}:    email: ${GREEN}elaborador@matriz.dev${RESET}    | matrícula: ${GREEN}10002${RESET}`);
    console.log(`  - ${MAGENTA}Revisor${RESET}:       email: ${GREEN}revisor@matriz.dev${RESET}       | matrícula: ${GREEN}10003${RESET}`);
    console.log(`  - ${MAGENTA}Aprovador${RESET}:     email: ${GREEN}aprovador@matriz.dev${RESET}     | matrícula: ${GREEN}10004${RESET}`);
    console.log(`  - ${MAGENTA}Administrador${RESET}: email: ${GREEN}administrador@matriz.dev${RESET} | matrícula: ${GREEN}10005${RESET}`);
  }
  console.log(`${CYAN}======================================================================${RESET}\n`);
}

function printManagementMenu() {
  console.log(`\n${CYAN}----------------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}Para gerenciar a aplicação:${RESET}`);
  console.log(`  - Iniciar / Flush:  ${GREEN}npm start${RESET}`);
  console.log(`  - Reiniciar tudo:   ${GREEN}npm run restart${RESET}`);
  console.log(`  - Parar aplicação:  ${GREEN}npm run stop${RESET}`);
  console.log(`  - Parar tudo+banco: ${GREEN}npm run down${RESET}`);
  console.log(`  - Deploy do zero:   ${GREEN}npm run deploy${RESET}`);
  console.log(`  - Deploy + Seed:    ${GREEN}npm run deploy:seed${RESET}`);
  console.log(`  - Semear forms:     ${GREEN}npm run seed:proprietary${RESET}`);
  console.log(`  - Verificar status: ${GREEN}npm run status${RESET}`);
  console.log(`${CYAN}======================================================================${RESET}\n`);
}

// Parar processos locais
function stopApp() {
  console.log(`${YELLOW}Parando processos locais da aplicação FormOps (Backend e Frontend)...${RESET}`);
  const { api, web } = getSavedPids();

  const killPidGroup = (pid, label) => {
    if (!pid || !isPidAlive(pid)) return;
    console.log(`Parando ${label} (PID: ${pid})...`);
    try {
      const pgid = runOut(`ps -o pgid= -p ${pid}`);
      if (pgid && pgid !== '0') {
        run(`kill -- -${pgid}`, { ignoreError: true });
      } else {
        process.kill(Number(pid), 'SIGTERM');
      }
    } catch {}

    let tries = 0;
    while (isPidAlive(pid) && tries < 10) {
      execSync('sleep 0.5');
      tries++;
    }
    if (isPidAlive(pid)) {
      try { process.kill(Number(pid), 'SIGKILL'); } catch {}
    }
  };

  killPidGroup(api, 'Backend API');
  killPidGroup(web, 'Frontend Web');
  removePidFile();

  // Limpeza de porta adicional
  [process.env.API_PORT, process.env.WEB_PORT].forEach(port => {
    if (!port) return;
    try {
      const pids = runOut(`lsof -ti :${port}`);
      if (pids) {
        pids.split(/\s+/).forEach(p => {
          if (p && p !== String(process.pid)) {
            console.log(`Matando processo residual ${p} na porta ${port}...`);
            try { process.kill(Number(p), 'SIGKILL'); } catch {}
          }
        });
      }
    } catch {}
  });

  console.log(`${GREEN}✓ Processos locais finalizados.${RESET}`);
}

// Derrubar app e containers
function downApp() {
  stopApp();
  if (DOCKER_COMPOSE) {
    console.log(`Derrubando infraestrutura Docker (${DOCKER_COMPOSE} down)...`);
    run(`${DOCKER_COMPOSE} down`, { ignoreError: true });
  }
  console.log(`${GREEN}✓ Todos os serviços e containers foram encerrados!${RESET}`);
}

// Aguardar PostgreSQL e migrar
async function waitAndMigrateDb() {
  console.log(`${YELLOW}Aguardando banco de dados PostgreSQL aceitar conexões...${RESET}`);
  let retries = 0;
  let ok = false;
  const MAX_RETRIES = 45; // até 90 segundos de tolerância para initdb de novos volumes Docker
  while (retries < MAX_RETRIES) {
    try {
      execSync('npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma', { cwd: ROOT_DIR, stdio: 'ignore' });
      console.log(`${GREEN}✓ Banco de dados pronto e migrações aplicadas!${RESET}`);
      ok = true;
      break;
    } catch {
      retries++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!ok) {
    console.error(`${RED}Erro: O banco de dados PostgreSQL não respondeu no tempo limite.${RESET}`);
    run('npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma');
    process.exit(1);
  }
  console.log('Gerando Prisma Client...');
  run('npm run prisma:generate --workspace=apps/api');
}

// Aguardar MinIO e provisionar os buckets com Object Lock (T007/T008):
// o lock so pode ser habilitado na criacao do bucket, entao isto roda
// antes da API subir, nunca sob demanda no primeiro upload.
async function waitAndProvisionBuckets() {
  console.log(`${YELLOW}Provisionando buckets de evidencia (imutavel + quarentena)...${RESET}`);
  let retries = 0;
  let ok = false;
  const MAX_RETRIES = 30; // ate 60s de tolerancia para o MinIO subir
  while (retries < MAX_RETRIES) {
    try {
      execSync('npm run provision:buckets --workspace=apps/api', { cwd: ROOT_DIR, stdio: 'ignore' });
      console.log(`${GREEN}✓ Buckets de evidencia provisionados!${RESET}`);
      ok = true;
      break;
    } catch {
      retries++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!ok) {
    console.error(`${RED}Erro: nao foi possivel provisionar os buckets de evidencia no MinIO.${RESET}`);
    run('npm run provision:buckets --workspace=apps/api');
    process.exit(1);
  }
}

// Iniciar processos da aplicação
function startProcesses() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

  console.log(`\n${CYAN}Iniciando os serviços da aplicação em background (${process.env.NODE_ENV})...${RESET}`);
  const isProd = process.env.NODE_ENV === 'production';

  const apiLog = fs.openSync(path.join(LOGS_DIR, 'api.log'), 'a');
  const webLog = fs.openSync(path.join(LOGS_DIR, 'web.log'), 'a');

  let apiProc, webProc;

  if (isProd) {
    console.log('Limpando builds e caches antigos do NestJS...');
    run('rm -rf apps/api/dist apps/api/tsconfig.tsbuildinfo', { ignoreError: true });
    console.log('Executando build de produção (npm run build)...');
    run('npm run build');

    console.log('Iniciando backend (API NestJS) em produção...');
    apiProc = spawn('npm', ['run', 'start', '--workspace=apps/api'], {
      cwd: ROOT_DIR, detached: true, stdio: ['ignore', apiLog, apiLog]
    });

    console.log(`Iniciando frontend (Preview Vite) na porta ${process.env.WEB_PORT}...`);
    webProc = spawn('npm', ['run', 'preview', '--workspace=apps/web', '--', '--port', process.env.WEB_PORT, '--host'], {
      cwd: ROOT_DIR, detached: true, stdio: ['ignore', webLog, webLog]
    });
  } else {
    console.log('Iniciando backend (API NestJS) em modo dev...');
    apiProc = spawn('npm', ['run', 'dev:api'], {
      cwd: ROOT_DIR, detached: true, stdio: ['ignore', apiLog, apiLog]
    });

    console.log('Iniciando frontend (Vite) em modo dev...');
    webProc = spawn('npm', ['run', 'dev:web'], {
      cwd: ROOT_DIR, detached: true, stdio: ['ignore', webLog, webLog]
    });
  }

  apiProc.unref();
  webProc.unref();

  savePids(apiProc.pid, webProc.pid);
  return { apiPid: apiProc.pid, webPid: webProc.pid };
}

// Validar Healthcheck
async function validateHealth(apiPid, webPid) {
  console.log(`\n${CYAN}Validando a inicialização da aplicação...${RESET}`);
  const apiPort = process.env.API_PORT;
  const webPort = process.env.WEB_PORT;

  console.log(`Aguardando resposta do healthcheck da API (http://localhost:${apiPort}/health)...`);
  await new Promise(r => setTimeout(r, 5000));

  let healthOk = false;
  for (let i = 0; i < 40; i++) {
    const code = runOut(`curl -s -w "%{http_code}" -o /dev/null "http://localhost:${apiPort}/health"`);
    if (code === '200') {
      healthOk = true;
      break;
    }
    if (!isPidAlive(apiPid)) {
      console.error(`${RED}Erro: O processo da API backend (PID ${apiPid}) encerrou inesperadamente.${RESET}`);
      break;
    }
    console.log(`Aguardando API ficar online... (${i + 1}/40)`);
    await new Promise(r => setTimeout(r, 2000));
  }

  let webOk = false;
  if (healthOk) {
    const webCode = runOut(`curl -s -w "%{http_code}" -o /dev/null "http://localhost:${webPort}"`);
    if (webCode && webCode !== '000') {
      webOk = true;
    }
  }

  if (healthOk && webOk) {
    console.log(`\n${GREEN}======================================================================${RESET}`);
    console.log(`${GREEN}✓ APLICAÇÃO INICIADA E VALIDADA COM SUCESSO! (Modo Background)${RESET}`);
    console.log(`${GREEN}======================================================================${RESET}`);
    console.log(`API Backend (NestJS): ${GREEN}ONLINE${RESET} (${CYAN}http://localhost:${apiPort}/health${RESET})`);
    console.log(`Web Frontend (Vite):  ${GREEN}ONLINE${RESET} (${CYAN}http://localhost:${webPort}${RESET})`);
    console.log(`Ambiente (.env):       ${GREEN}NODE_ENV=${process.env.NODE_ENV}${RESET}`);
    console.log(`Logs do Backend:       ${YELLOW}logs/api.log${RESET}`);
    console.log(`Logs do Frontend:      ${YELLOW}logs/web.log${RESET}`);

    printDockerStatus();
    printManagementMenu();
    printUserList();
  } else {
    console.log(`\n${RED}======================================================================${RESET}`);
    console.log(`${RED}❌ FALHA NA INICIALIZAÇÃO DA APLICAÇÃO!${RESET}`);
    console.log(`${RED}======================================================================${RESET}`);
    console.log('Exibindo as últimas 20 linhas de log do Backend (logs/api.log):');
    run('tail -n 20 logs/api.log', { ignoreError: true });
    stopApp();
    process.exit(1);
  }
}

// Comandos
async function commandStart() {
  const { api, web } = getSavedPids();
  let isFlush = false;
  if (isPidAlive(api) && isPidAlive(web)) {
    console.log(`${YELLOW}Aplicação FormOps já está em execução (API PID ${api}, Web PID ${web}).${RESET}`);
    console.log(`${CYAN}Realizando FLUSH / RELOAD dos processos para carregar atualizações no código...${RESET}`);
    stopApp();
    isFlush = true;
  }

  if (!isFlush) {
    console.log(`${CYAN}=== Iniciando a Aplicação FormOps (Modo Start) ===${RESET}`);
  }

  if (DOCKER_COMPOSE) {
    console.log('Subindo containers de suporte (PostgreSQL + MinIO)...');
    run(`${DOCKER_COMPOSE} up -d postgres minio clamav`);
  }

  await waitAndMigrateDb();
  await waitAndProvisionBuckets();

  if (!isFlush) {
    if (process.env.SEED_ON_START === 'true' || process.env.NODE_ENV === 'development') {
      console.log('Executando carga de dados de seed...');
      run('npm run seed --workspace=apps/api', { ignoreError: true });
      if (process.env.SEED_PROPRIETARY_FORMS === 'true') {
        console.log('Semeando formulários proprietários...');
        run('npm run seed:n1 --workspace=apps/api', { ignoreError: true });
        run('npm run seed:n3 --workspace=apps/api', { ignoreError: true });
      }
    }
  }

  const { apiPid, webPid } = startProcesses();
  await validateHealth(apiPid, webPid);
}

async function commandStatus() {
  const { api, web } = getSavedPids();
  const apiAlive = isPidAlive(api);
  const webAlive = isPidAlive(web);

  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}                 Status da Aplicação FormOps (Background)             ${RESET}`);
  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`API Backend (NestJS): ${apiAlive ? `${GREEN}ONLINE${RESET} (${CYAN}http://localhost:${process.env.API_PORT}/health${RESET}, PID: ${api})` : `${RED}OFFLINE${RESET}`}`);
  console.log(`Web Frontend (Vite):  ${webAlive ? `${GREEN}ONLINE${RESET} (${CYAN}http://localhost:${process.env.WEB_PORT}${RESET}, PID: ${web})` : `${RED}OFFLINE${RESET}`}`);
  console.log(`Ambiente (.env):       ${GREEN}NODE_ENV=${process.env.NODE_ENV}${RESET}`);
  console.log(`Logs do Backend:       ${YELLOW}logs/api.log${RESET}`);
  console.log(`Logs do Frontend:      ${YELLOW}logs/web.log${RESET}`);

  console.log(`\n${CYAN}Verificando ocupação das portas da aplicação...${RESET}`);
  const apiPortCheck = await checkPort(process.env.API_PORT);
  if (apiPortCheck.inUse) {
    if (isFormOpsPid(apiPortCheck.pid)) {
      console.log(`  ${GREEN}✓ Porta API (${process.env.API_PORT}):${RESET} Em uso pela própria aplicação FormOps (${CYAN}PID: ${apiPortCheck.pid}${RESET})`);
    } else {
      console.log(`  ${YELLOW}⚠ Porta API (${process.env.API_PORT}):${RESET} ${YELLOW}Ocupada por outro serviço externo (PID: ${apiPortCheck.pid})${RESET}`);
    }
  } else {
    console.log(`  ${GREEN}✓ Porta API (${process.env.API_PORT}):${RESET} ${GREEN}LIVRE${RESET}`);
  }

  const webPortCheck = await checkPort(process.env.WEB_PORT);
  if (webPortCheck.inUse) {
    if (isFormOpsPid(webPortCheck.pid)) {
      console.log(`  ${GREEN}✓ Porta Frontend (${process.env.WEB_PORT}):${RESET} Em uso pela própria aplicação FormOps (${CYAN}PID: ${webPortCheck.pid}${RESET})`);
    } else {
      console.log(`  ${YELLOW}⚠ Porta Frontend (${process.env.WEB_PORT}):${RESET} ${YELLOW}Ocupada por outro serviço externo (PID: ${webPortCheck.pid})${RESET}`);
    }
  } else {
    console.log(`  ${GREEN}✓ Porta Frontend (${process.env.WEB_PORT}):${RESET} ${GREEN}LIVRE${RESET}`);
  }

  printDockerStatus();
  printManagementMenu();
  printUserList();
}

async function commandRestart() {
  console.log(`${CYAN}=== Reiniciando a aplicação e os containers Docker (Modo Restart) ===${RESET}`);
  stopApp();
  if (DOCKER_COMPOSE) {
    console.log(`Garantindo containers Docker ativos (${DOCKER_COMPOSE} up -d)...`);
    run(`${DOCKER_COMPOSE} up -d postgres minio clamav`, { ignoreError: true });
    run(`${DOCKER_COMPOSE} restart`, { ignoreError: true });
  }
  await waitAndMigrateDb();
  await waitAndProvisionBuckets();

  if (process.env.SEED_ON_START === 'true' || process.env.NODE_ENV === 'development') {
    console.log('Executando carga de dados de seed...');
    run('npm run seed --workspace=apps/api', { ignoreError: true });
  }

  const { apiPid, webPid } = startProcesses();
  await validateHealth(apiPid, webPid);
}

async function commandDeploy(withSeeds = false) {
  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}        INICIANDO DEPLOY LIMPO DO ZERO (${withSeeds ? 'CLEAN DEPLOY + SEED PROPRIETÁRIO' : 'CLEAN DEPLOY'})                 ${RESET}`);
  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`${YELLOW}Limpando processos, containers, volumes Docker, node_modules e dists...${RESET}`);

  stopApp();
  if (DOCKER_COMPOSE) {
    console.log('Derrubando infraestrutura Docker e removendo volumes (-v)...');
    run(`${DOCKER_COMPOSE} down -v --remove-orphans`, { ignoreError: true });
  }

  console.log('Removendo pastas node_modules e dists do projeto...');
  run('rm -rf node_modules apps/api/node_modules apps/web/node_modules apps/api/dist apps/web/dist apps/web/dist-build .prisma', { ignoreError: true });

  console.log('\nInstalando dependências npm do zero (npm install)...');
  run('npm install --ignore-scripts --no-audit');

  if (DOCKER_COMPOSE) {
    console.log('Subindo novos containers Docker (PostgreSQL + MinIO + ClamAV)...');
    run(`${DOCKER_COMPOSE} up -d postgres minio clamav`);
  }

  await waitAndMigrateDb();
  await waitAndProvisionBuckets();
  console.log('\nExecutando carga de dados de seed (Admin + Usuários de Teste Dev)...');
  run('npm run seed --workspace=apps/api');

  if (withSeeds || process.env.SEED_PROPRIETARY_FORMS === 'true') {
    console.log('\nSemeando formulários proprietários (N1 e N3)...');
    run('npm run seed:n1 --workspace=apps/api');
    run('npm run seed:n3 --workspace=apps/api');
  }

  const { apiPid, webPid } = startProcesses();
  await validateHealth(apiPid, webPid);
}

function commandSeed() {
  console.log(`${CYAN}=== Semeando Formulários Proprietários (N1/N3) ===${RESET}`);
  console.log('Verificando conexão com o banco de dados PostgreSQL...');
  try {
    execSync('npx prisma migrate status --schema=apps/api/prisma/schema.prisma', { cwd: ROOT_DIR, stdio: 'ignore' });
  } catch {
    console.error(`${RED}Erro: O banco de dados PostgreSQL não está em execução ou não está aceitando conexões.${RESET}`);
    console.log(`${YELLOW}Por favor, inicie a aplicação/banco executando 'npm start' antes de semear.${RESET}`);
    process.exit(1);
  }

  run('npm run prisma:generate --workspace=apps/api', { ignoreError: true });
  console.log('\nSemeando Formulário Proprietário N1 (seed-n1.ts)...');
  run('npm run seed:n1 --workspace=apps/api');

  console.log('\nSemeando Formulário Proprietário N3 (seed-n3.ts)...');
  run('npm run seed:n3 --workspace=apps/api');

  console.log(`\n${GREEN}======================================================================${RESET}`);
  console.log(`${GREEN}✓ FORMULÁRIOS PROPRIETÁRIOS (N1 E N3) SEMEADOS COM SUCESSO!${RESET}`);
  console.log(`${GREEN}======================================================================${RESET}\n`);
}

function commandSeedDemo() {
  console.log(`${CYAN}=== Semeando Ambiente de Demonstração (5 Unidades / Jan-Jun 2026) ===${RESET}`);
  console.log('Verificando conexão com o banco de dados PostgreSQL...');
  try {
    execSync('npx prisma migrate status --schema=apps/api/prisma/schema.prisma', { cwd: ROOT_DIR, stdio: 'ignore' });
  } catch {
    console.error(`${RED}Erro: O banco de dados PostgreSQL não está em execução ou não está aceitando conexões.${RESET}`);
    console.log(`${YELLOW}Por favor, inicie a aplicação/banco executando 'npm start' antes de semear.${RESET}`);
    process.exit(1);
  }

  run('npm run prisma:generate --workspace=apps/api', { ignoreError: true });
  console.log('\n1/4 Garantindo Seed Core (Admin e Usuários Base)...');
  run('npm run seed --workspace=apps/api');

  console.log('\n2/4 Semeando Formulário Proprietário N1 (seed-n1.ts)...');
  run('npm run seed:n1 --workspace=apps/api');

  console.log('\n3/4 Semeando Formulário Proprietário N3 (seed-n3.ts)...');
  run('npm run seed:n3 --workspace=apps/api');

  console.log('\n4/4 Semeando Dados de Demonstração (5 Unidades Hospitalares / 6 Meses de Relatórios)...');
  run('npm run seed:demo --workspace=apps/api');

  console.log(`\n${GREEN}======================================================================${RESET}`);
  console.log(`${GREEN}✓ DADOS DA DEMONSTRAÇÃO SEMEADOS COM SUCESSO!${RESET}`);
  console.log(`${GREEN}======================================================================${RESET}\n`);
}

async function commandSummary() {
  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}      FormOps - Validação da Stack e Instruções de Gerenciamento      ${RESET}`);
  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`Modo detectado em .env: ${GREEN}NODE_ENV=${process.env.NODE_ENV}${RESET}\n`);

  console.log(`${CYAN}[1/3] Verificando pré-requisitos da stack...${RESET}`);
  const nodeVer = runOut('node -v');
  console.log(`  ${GREEN}✓${RESET} Node.js (${GREEN}${nodeVer}${RESET})`);
  const npmVer = runOut('npm -v');
  console.log(`  ${GREEN}✓${RESET} npm (${GREEN}v${npmVer}${RESET})`);
  if (DOCKER_COMPOSE) {
    const docVer = runOut(`${DOCKER_COMPOSE} version | head -n 1`);
    console.log(`  ${GREEN}✓${RESET} Docker Compose (${GREEN}${docVer}${RESET})`);
  }

  console.log(`\n${CYAN}Verificando ocupação das portas da aplicação...${RESET}`);
  const apiPortCheck = await checkPort(process.env.API_PORT);
  const webPortCheck = await checkPort(process.env.WEB_PORT);

  if (apiPortCheck.inUse) {
    console.log(`  ${GREEN}✓ Porta API (${process.env.API_PORT}):${RESET} Em uso pela própria aplicação FormOps (${CYAN}PID: ${apiPortCheck.pid}${RESET})`);
  } else {
    console.log(`  ${GREEN}✓ Porta API (${process.env.API_PORT}):${RESET} ${GREEN}LIVRE${RESET}`);
  }

  if (webPortCheck.inUse) {
    console.log(`  ${GREEN}✓ Porta Frontend (${process.env.WEB_PORT}):${RESET} Em uso pela própria aplicação FormOps (${CYAN}PID: ${webPortCheck.pid}${RESET})`);
  } else {
    console.log(`  ${GREEN}✓ Porta Frontend (${process.env.WEB_PORT}):${RESET} ${GREEN}LIVRE${RESET}`);
  }

  const { api, web } = getSavedPids();
  console.log(`\n${CYAN}[3/3] Verificando status dos serviços locais e containers...${RESET}`);
  console.log(`  API Backend (PID ${api || 'N/A'}):  ${isPidAlive(api) ? `${GREEN}ONLINE${RESET}` : `${RED}OFFLINE${RESET}`}`);
  console.log(`  Web Frontend (PID ${web || 'N/A'}): ${isPidAlive(web) ? `${GREEN}ONLINE${RESET}` : `${RED}OFFLINE${RESET}`}`);

  printDockerStatus();

  console.log(`\n${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}                    Lista de Comandos NPM Disponíveis                 ${RESET}`);
  console.log(`${CYAN}======================================================================${RESET}`);
  console.log(`  ${GREEN}npm start${RESET}               : Inicia a aplicação. Verifica o que já está rodando`);
  console.log(`                              e sobe apenas o necessário (flush/reload se ativo).`);
  console.log(`  ${GREEN}npm run restart${RESET}         : Reinicia a aplicação e os containers Docker.`);
  console.log(`  ${GREEN}npm run stop${RESET}            : Encerra os processos locais da aplicação.`);
  console.log(`  ${GREEN}npm run down${RESET}            : Encerra a aplicação e derruba os containers Docker.`);
  console.log(`  ${GREEN}npm run deploy${RESET}          : Realiza deploy limpo do zero.`);
  console.log(`  ${GREEN}npm run deploy:seed${RESET}     : Realiza deploy limpo do zero + semeadura dos formulários.`);
  console.log(`  ${GREEN}npm run seed:proprietary${RESET}: Popula o banco com os formulários proprietários (N1/N3).`);
  console.log(`  ${GREEN}npm run status${RESET}          : Exibe o status dos processos locais e containers.`);
  console.log(`${CYAN}======================================================================${RESET}\n`);

  printUserList();
}

async function main() {
  const action = process.argv[2];
  switch (action) {
    case 'start':
      await commandStart();
      break;
    case 'status':
      await commandStatus();
      break;
    case 'restart':
      await commandRestart();
      break;
    case 'stop':
      stopApp();
      break;
    case 'down':
      downApp();
      break;
    case 'deploy':
      await commandDeploy(false);
      break;
    case 'deploy:seed':
    case 'deploy-seed':
    case 'deploy_seed':
      await commandDeploy(true);
      break;
    case 'seed':
      commandSeed();
      break;
    case 'seed:demo':
    case 'seed-demo':
    case 'seed_demo':
      commandSeedDemo();
      break;
    default:
      await commandSummary();
      break;
  }
}

main().catch(err => {
  console.error(`${RED}Erro ao executar comando: ${err.message}${RESET}`);
  process.exit(1);
});
