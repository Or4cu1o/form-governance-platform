import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const existing = await this.prisma.systemSetting.findFirst();
    if (existing) {
      return existing;
    }
    return this.prisma.systemSetting.create({ data: {} });
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    const settings = await this.getSettings();

    const elaborationDay = dto.slaElaborationBusinessDay ?? settings.slaElaborationBusinessDay;
    const reviewDay = dto.slaReviewBusinessDay ?? settings.slaReviewBusinessDay;
    const approvalDay = dto.slaApprovalBusinessDay ?? settings.slaApprovalBusinessDay;
    if (!(elaborationDay < reviewDay && reviewDay < approvalDay)) {
      throw new BadRequestException(
        'Os prazos de SLA devem ser crescentes: elaboracao < revisao < aprovacao.',
      );
    }

    return this.prisma.systemSetting.update({
      where: { id: settings.id },
      data: {
        ...(dto.exportNamingPattern !== undefined && { exportNamingPattern: dto.exportNamingPattern }),
        ...(dto.slaElaborationBusinessDay !== undefined && {
          slaElaborationBusinessDay: dto.slaElaborationBusinessDay,
        }),
        ...(dto.slaReviewBusinessDay !== undefined && { slaReviewBusinessDay: dto.slaReviewBusinessDay }),
        ...(dto.slaApprovalBusinessDay !== undefined && { slaApprovalBusinessDay: dto.slaApprovalBusinessDay }),
        ...(dto.slaReprovalExtensionDays !== undefined && {
          slaReprovalExtensionDays: dto.slaReprovalExtensionDays,
        }),
        ...(dto.slaDeflatorScore !== undefined && { slaDeflatorScore: dto.slaDeflatorScore }),
        ...(dto.evidenceRetentionYears !== undefined && { evidenceRetentionYears: dto.evidenceRetentionYears }),
        ...(dto.includeOptionalHolidays !== undefined && { includeOptionalHolidays: dto.includeOptionalHolidays }),
        ...(dto.auditMaxRangeMonths !== undefined && { auditMaxRangeMonths: dto.auditMaxRangeMonths }),
        ...(dto.auditDetailedMaxRangeMonths !== undefined && {
          auditDetailedMaxRangeMonths: dto.auditDetailedMaxRangeMonths,
        }),
        ...(dto.auditExactCountThreshold !== undefined && { auditExactCountThreshold: dto.auditExactCountThreshold }),
        ...(dto.outlierRule !== undefined && { outlierRule: dto.outlierRule }),
        ...(dto.forensicHoldYears !== undefined && { forensicHoldYears: dto.forensicHoldYears }),
      },
    });
  }
}
