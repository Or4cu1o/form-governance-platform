import { Module } from '@nestjs/common';
import { SealingModule } from '../sealing/sealing.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [SealingModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
