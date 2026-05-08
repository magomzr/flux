import { Module } from '@nestjs/common';
import { FlagsController } from './controllers/flags.controller';
import { FlagsService } from './services/flags.service';

@Module({
  controllers: [FlagsController],
  providers: [FlagsService],
  exports: [FlagsService],
})
export class FlagsModule {}
