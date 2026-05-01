import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminOrApiKeyGuard } from '@/modules/auth/admin-or-api-key.guard';
import { TrafficEventsService } from './traffic-events.service';

@ApiTags('Traffic Events')
@Controller('traffic-events')
@UseGuards(AdminOrApiKeyGuard)
export class TrafficEventsController {
  constructor(private readonly trafficEventsService: TrafficEventsService) {}

  @Get('recent')
  @ApiOperation({ summary: 'Recent traffic learning events' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'minRisk', required: false, type: Number })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'clientIp', required: false, type: String })
  async recent(
    @Query('limit') limit?: string,
    @Query('minRisk') minRisk?: string,
    @Query('eventType') eventType?: string,
    @Query('clientIp') clientIp?: string,
  ) {
    return this.trafficEventsService.getRecentEvents({
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      minRisk: minRisk ? Number.parseInt(minRisk, 10) : undefined,
      eventType: eventType || undefined,
      clientIp: clientIp || undefined,
    });
  }

  @Get('suspicious')
  @ApiOperation({ summary: 'Aggregate suspicious clients from recent traffic events' })
  @ApiQuery({ name: 'hours', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async suspicious(
    @Query('hours') hours?: string,
    @Query('limit') limit?: string,
  ) {
    return this.trafficEventsService.getSuspiciousSubjects({
      hours: hours ? Number.parseInt(hours, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }
}
