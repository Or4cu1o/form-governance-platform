import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogEntryDto } from './create-catalog-entry.dto';

export class UpdateCatalogEntryDto extends PartialType(CreateCatalogEntryDto) {}
