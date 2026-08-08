import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { createPrivateKey, createPublicKey, KeyObject } from 'crypto';
import { join, dirname } from 'path';

export interface SealingKeyPair {
  keyId: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

// Convencao de custodia: SEALING_PRIVATE_KEY_PATH aponta para o arquivo PEM
// da chave privada ATIVA (montado com permissao restrita em desenvolvimento,
// referencia a servico de gestao de chaves em producao — o valor da env var
// e sempre uma referencia, nunca o material). Chaves aposentadas ficam no
// diretorio irmao "retired/", apenas a parte PUBLICA (<keyId>.pub.pem):
// depois da rotacao a chave privada anterior nao e mais necessaria para
// assinar, e manter so a publica reduz a superficie de exposicao do
// material sensivel sem invalidar selos ja emitidos (FR-104).
@Injectable()
export class KeyCustodyService implements OnModuleInit {
  private readonly logger = new Logger(KeyCustodyService.name);
  private activeKeyId!: string;
  private activeKeyPair!: SealingKeyPair;
  private readonly retiredPublicKeys = new Map<string, KeyObject>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const activePrivateKeyPath = this.configService.getOrThrow<string>('SEALING_PRIVATE_KEY_PATH');
    this.activeKeyId = this.configService.getOrThrow<string>('SEALING_KEY_ID');

    const privateKey = createPrivateKey(readFileSync(activePrivateKeyPath));
    const publicKey = createPublicKey(privateKey);
    this.activeKeyPair = { keyId: this.activeKeyId, privateKey, publicKey };

    this.loadRetiredPublicKeys(dirname(activePrivateKeyPath));
    this.logger.log(`Chave de selagem ativa carregada (keyId=${this.activeKeyId})`);
  }

  private loadRetiredPublicKeys(activeKeyDir: string): void {
    const retiredDir = join(activeKeyDir, 'retired');
    if (!existsSync(retiredDir)) {
      return;
    }
    for (const fileName of readdirSync(retiredDir)) {
      if (!fileName.endsWith('.pub.pem')) continue;
      const keyId = fileName.replace(/\.pub\.pem$/, '');
      const publicKey = createPublicKey(readFileSync(join(retiredDir, fileName)));
      this.retiredPublicKeys.set(keyId, publicKey);
    }
  }

  // Toda leitura da chave privada e um evento que a trilha de auditoria
  // deve poder correlacionar — nunca o material, apenas o fato do acesso.
  getActiveKeyPair(): SealingKeyPair {
    this.logger.log(`Acesso a chave privada de selagem (keyId=${this.activeKeyPair.keyId})`);
    return this.activeKeyPair;
  }

  getActiveKeyId(): string {
    return this.activeKeyId;
  }

  // Resolve a chave publica de qualquer keyId conhecido — ativo ou
  // aposentado — para que um selo emitido sob uma chave anterior continue
  // verificavel indefinidamente (FR-104).
  getPublicKey(keyId: string): KeyObject | undefined {
    if (keyId === this.activeKeyId) {
      return this.activeKeyPair.publicKey;
    }
    return this.retiredPublicKeys.get(keyId);
  }

  listKnownKeyIds(): string[] {
    return [this.activeKeyId, ...this.retiredPublicKeys.keys()];
  }

  isRetired(keyId: string): boolean {
    return keyId !== this.activeKeyId && this.retiredPublicKeys.has(keyId);
  }
}
