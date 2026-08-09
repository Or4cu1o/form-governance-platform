import {
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { EVIDENCE_MIME_TYPE_FILTER, MAX_EVIDENCE_UPLOAD_BYTES } from '../common/evidence-upload.constants';
import { EvidenceService } from './evidence.service';

@Controller()
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Roles(RoleName.ELABORADOR, RoleName.REVISOR)
  @Post('indicator-responses/:id/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_EVIDENCE_UPLOAD_BYTES },
      fileFilter: EVIDENCE_MIME_TYPE_FILTER,
    }),
  )
  upload(
    @Param('id') indicatorResponseId: string,
    @UploadedFile(
      new ParseFilePipeBuilder().build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evidenceService.uploadForIndicatorResponse(indicatorResponseId, user, file);
  }

  @Get('evidence-files/:id/download-url')
  getDownloadUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evidenceService.getDownloadUrl(id, user);
  }

  // T049b — mesmo prefixo "evidence-files/" da rota de download acima
  // (nao "evidence/:id/deactivate" literal do texto da tarefa), para nao
  // introduzir uma segunda convencao de nomeacao de rota so para esta
  // entidade.
  @Roles(RoleName.ELABORADOR, RoleName.REVISOR)
  @Post('evidence-files/:id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evidenceService.deactivate(id, user);
  }
}
