import { IsIn } from 'class-validator';

export class ExportReportQueryDto {
  @IsIn(['csv', 'json', 'pdf'])
  format!: 'csv' | 'json' | 'pdf';
}
