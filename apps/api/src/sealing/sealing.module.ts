import { Module } from '@nestjs/common';
import { KeyCustodyService } from './key-custody.service';
import { SealService } from './seal.service';
import { SignatureService } from './signature.service';

// Sem controller proprio: emissao de selo e consumida por export/ (T133,
// T135) e a verificacao publica vive em verification/ (T136-T140) — este
// modulo so provê a custodia de chave, a assinatura e o registro do selo.
@Module({
  providers: [KeyCustodyService, SignatureService, SealService],
  exports: [KeyCustodyService, SignatureService, SealService],
})
export class SealingModule {}
