import { IsNotEmpty, IsString } from 'class-validator';

export class ForensicReleaseDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
