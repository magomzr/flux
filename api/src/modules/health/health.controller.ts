import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('seed-hash')
  async seedHash() {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('admin123', 10);
    return { hash };
  }
}
