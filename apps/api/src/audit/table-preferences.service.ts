import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SaveTablePreferenceDto } from './dto/save-table-preference.dto';

// T119a/FR-090: ordenacao e visibilidade de coluna sao apresentacao, nunca
// filtro. Esta service nunca participa de nenhum caminho de consulta ou
// agregacao de AuditQueryService — so le/grava a preferencia de tela.
@Injectable()
export class TablePreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tableKey: string, user: AuthenticatedUser) {
    const preference = await this.prisma.userTablePreference.findUnique({
      where: { userId_tableKey: { userId: user.id, tableKey } },
    });
    return preference ?? { userId: user.id, tableKey, columnOrder: [], hiddenColumns: [] };
  }

  async save(tableKey: string, dto: SaveTablePreferenceDto, user: AuthenticatedUser) {
    return this.prisma.userTablePreference.upsert({
      where: { userId_tableKey: { userId: user.id, tableKey } },
      create: { userId: user.id, tableKey, columnOrder: dto.columnOrder ?? [], hiddenColumns: dto.hiddenColumns ?? [] },
      update: { columnOrder: dto.columnOrder ?? [], hiddenColumns: dto.hiddenColumns ?? [] },
    });
  }
}
