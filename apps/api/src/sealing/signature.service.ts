import { Injectable } from '@nestjs/common';
import { sign, verify } from 'crypto';
import { KeyCustodyService } from './key-custody.service';

export interface SignedDigest {
  signature: string;
  keyId: string;
}

// Ed25519 via node:crypto nativo (research.md D3): crypto.sign(null, ...)
// aceita null como algoritmo de hash porque Ed25519 assina a mensagem
// diretamente, sem pre-hash externo — e por isso o contentDigest (ja um
// SHA-256) e assinado como esta, nao re-hasheado.
@Injectable()
export class SignatureService {
  constructor(private readonly keyCustodyService: KeyCustodyService) {}

  signContentDigest(contentDigest: string): SignedDigest {
    const { privateKey, keyId } = this.keyCustodyService.getActiveKeyPair();
    const signature = sign(null, Buffer.from(contentDigest, 'utf8'), privateKey);
    return { signature: signature.toString('base64'), keyId };
  }

  // Verificacao offline (FR-104/cenario US7-11): usa apenas o
  // contentDigest, a assinatura e o keyId estampados no documento — nao
  // depende de nenhuma outra chamada a esta classe nem a plataforma.
  verify(contentDigest: string, signatureBase64: string, keyId: string): boolean {
    const publicKey = this.keyCustodyService.getPublicKey(keyId);
    if (!publicKey) {
      return false;
    }
    try {
      return verify(null, Buffer.from(contentDigest, 'utf8'), publicKey, Buffer.from(signatureBase64, 'base64'));
    } catch {
      return false;
    }
  }
}
