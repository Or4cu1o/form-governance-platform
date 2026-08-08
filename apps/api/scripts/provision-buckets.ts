import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketVersioningCommand,
  PutObjectLockConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3';

// Provisionamento determinístico dos buckets de evidência com Object Lock
// (D7, research.md): o lock só pode ser habilitado NA CRIAÇÃO do bucket —
// por isso este script roda antes da aplicação subir, não em onModuleInit
// como o bucket único legado em s3.service.ts.
const QUARANTINE_EXPIRATION_DAYS = 30;

function buildClient(): S3Client {
  return new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'true') === 'true',
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY'),
      secretAccessKey: requireEnv('S3_SECRET_KEY'),
    },
  });
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
  return value;
}

async function bucketExists(client: S3Client, bucket: string): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

async function provisionImmutableBucket(client: S3Client, bucket: string): Promise<void> {
  if (await bucketExists(client, bucket)) {
    console.log(`Bucket imutavel "${bucket}" ja existe — nao reconfigurado (lock so vale na criacao).`);
    return;
  }
  await client.send(new CreateBucketCommand({ Bucket: bucket, ObjectLockEnabledForBucket: true }));
  await client.send(
    new PutObjectLockConfigurationCommand({
      Bucket: bucket,
      ObjectLockConfiguration: { ObjectLockEnabled: 'Enabled' },
    }),
  );
  console.log(`Bucket imutavel "${bucket}" criado com versionamento e Object Lock habilitados.`);
}

async function provisionQuarantineBucket(client: S3Client, bucket: string): Promise<void> {
  if (!(await bucketExists(client, bucket))) {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket de quarentena "${bucket}" criado.`);
  }
  // Sem Object Lock: arquivos aqui sao mutaveis ate o veredito do
  // antivirus. Expiracao curta e rede de seguranca contra upload
  // abandonado, distinta da guarda pericial de 1 ano para BLOQUEADO
  // (aplicada pela aplicacao, nao pelo bucket — T158).
  await client.send(new PutBucketVersioningCommand({ Bucket: bucket, VersioningConfiguration: { Status: 'Suspended' } }));
  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'expurgo-quarentena-abandonada',
            Status: 'Enabled',
            Filter: {},
            Expiration: { Days: QUARANTINE_EXPIRATION_DAYS },
          },
        ],
      },
    }),
  );
  console.log(`Bucket de quarentena "${bucket}" com expiracao de ${QUARANTINE_EXPIRATION_DAYS} dias configurada.`);
}

async function main(): Promise<void> {
  const client = buildClient();
  await provisionImmutableBucket(client, requireEnv('S3_BUCKET_IMMUTABLE'));
  await provisionQuarantineBucket(client, requireEnv('S3_BUCKET_QUARANTINE'));
}

main().catch((error) => {
  console.error('Falha ao provisionar buckets de evidencia:', error);
  process.exit(1);
});
