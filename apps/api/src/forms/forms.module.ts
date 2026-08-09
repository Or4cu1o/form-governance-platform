import { Module } from '@nestjs/common';
import { FormIndicatorsController } from './form-indicators.controller';
import { FormIndicatorsService } from './form-indicators.service';
import { FormTemplatesController } from './form-templates.controller';
import { FormTemplatesService } from './form-templates.service';
import { FormTopicsController } from './form-topics.controller';
import { FormTopicsService } from './form-topics.service';

@Module({
  controllers: [FormTemplatesController, FormTopicsController, FormIndicatorsController],
  providers: [FormTemplatesService, FormTopicsService, FormIndicatorsService],
  exports: [FormIndicatorsService],
})
export class FormsModule {}
