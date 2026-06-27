import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDb } from './index';

@Global()
@Module({
  providers: [
    {
      provide: 'DB',
      useFactory: (config: ConfigService) => {
        return createDb(config.getOrThrow<string>('DATABASE_URL'));
      },
      inject: [ConfigService],
    },
  ],
  exports: ['DB'],
})
export class DbModule {}
