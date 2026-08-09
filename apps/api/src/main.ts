import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const enableHttps = process.env.ENABLE_HTTPS === 'true';
  let httpsOptions = undefined;

  if (enableHttps) {
    const keyPath = process.env.SSL_KEY_PATH;
    const certPath = process.env.SSL_CERT_PATH;
    if (keyPath && certPath) {
      const resolveRootPath = (p: string) => {
        if (path.isAbsolute(p)) return p;
        return path.resolve(process.cwd(), p);
      };
      httpsOptions = {
        key: fs.readFileSync(resolveRootPath(keyPath)),
        cert: fs.readFileSync(resolveRootPath(certPath)),
      };
    }
  }

  const app = await NestFactory.create(AppModule, { httpsOptions });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // CORS_ORIGIN restringe a origem em todo ambiente (T171 — o ramo aberto
  // anterior, enableCors() sem opcoes, e incompativel com sessao em cookie:
  // requisicao com credencial nao pode carregar Access-Control-Allow-Origin
  // curinga. validateEnv (env.validation.ts) ja falha o boot se a variavel
  // estiver ausente, entao aqui ela sempre existe.
  const corsOrigin = process.env.CORS_ORIGIN as string;
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });
  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
