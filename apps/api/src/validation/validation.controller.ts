import {
  Body,
  Controller,
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
import { ValidateIndicatorDto } from './dto/validate-indicator.dto';
import { ValidationService } from './validation.service';

@Roles(RoleName.APROVADOR)
@Controller()
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Post('indicator-responses/:id/validate')
  validateIndicator(
    @Param('id') id: string,
    @Body() dto: ValidateIndicatorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.validationService.validateIndicator(id, user, dto);
  }

  @Post('validation-records/:id/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_EVIDENCE_UPLOAD_BYTES },
      fileFilter: EVIDENCE_MIME_TYPE_FILTER,
    }),
  )
  uploadEvidence(
    @Param('id') id: string,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.validationService.uploadValidationEvidence(id, user, file);
  }

  @Post('report-instances/:id/finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.validationService.finalizeReport(id, user);
  }
}
