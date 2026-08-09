import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const PRESIGNED_URL_EXPIRES_SECONDS = 300;

// T049/T050: dois buckets distintos (data-model.md, Ordem de migracao;
// research.md D7) — o de quarentena recebe todo upload novo (sem Object
// Lock, com expiracao de 30 dias via lifecycle, ver
// scripts/provision-buckets.ts), o imutavel so recebe objetos ja liberados
// pelo antivirus, com retencao aplicada no momento da promocao. Os dois sao
// provisionados ANTES do boot da aplicacao pelo script dedicado — o Object
// Lock so pode ser habilitado na CRIACAO do bucket, o que onModuleInit (que
// roda depois) nao conseguiria fazer.
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly quarantineBucket: string;
  private readonly immutableBucket: string;

  constructor(private readonly configService: ConfigService) {
    this.quarantineBucket = this.configService.getOrThrow<string>('S3_BUCKET_QUARANTINE');
    this.immutableBucket = this.configService.getOrThrow<string>('S3_BUCKET_IMMUTABLE');
    this.client = new S3Client({
      endpoint: this.configService.getOrThrow<string>('S3_ENDPOINT'),
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: this.configService.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.configService.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  async onModuleInit() {
    for (const bucket of [this.quarantineBucket, this.immutableBucket]) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        this.logger.error(
          `Bucket "${bucket}" nao encontrado. Rode "scripts/provision-buckets.ts" (via npm run docker:up / scripts/manage.js) antes de iniciar a aplicacao — o Object Lock do bucket imutavel so pode ser habilitado na criacao, entao este servico nunca cria os buckets sozinho.`,
        );
      }
    }
  }

  getQuarantineBucketName(): string {
    return this.quarantineBucket;
  }

  getImmutableBucketName(): string {
    return this.immutableBucket;
  }

  // T049 (FR-036): todo upload novo aterrissa aqui — nome gerado pelo
  // servidor (prefixo UUID), nunca o nome original sozinho, para nao
  // colidir nem permitir path traversal via nome de arquivo do cliente.
  async uploadToQuarantine(buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
    const key = `${randomUUID()}-${originalName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.quarantineBucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return key;
  }

  async downloadObject(bucket: string, key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await response.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  // T050: chamado apenas quando o antivirus libera o arquivo. Copia para o
  // bucket imutavel com Object Lock em modo Compliance (retainUntil nulo =
  // retentionMode INDEFINIDA, sem data de expurgo para aplicar) e remove da
  // quarentena, que so existe como escala temporaria (FR-042).
  async promoteToImmutable(key: string, retainUntil: Date | null): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.immutableBucket,
        CopySource: `/${this.quarantineBucket}/${encodeURIComponent(key)}`,
        Key: key,
        ...(retainUntil
          ? { ObjectLockMode: 'COMPLIANCE' as const, ObjectLockRetainUntilDate: retainUntil }
          : {}),
      }),
    );
    await this.client.send(new DeleteObjectCommand({ Bucket: this.quarantineBucket, Key: key }));
  }

  async getPresignedDownloadUrl(bucket: string, key: string): Promise<string> {
    // ResponseContentDisposition=attachment forca o navegador a baixar em
    // vez de renderizar inline — mitigacao complementar a whitelist de MIME
    // no upload (Fase 12, achado HIGH: upload sem filtro de tipo de arquivo).
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: 'attachment',
    });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_URL_EXPIRES_SECONDS });
  }
}
