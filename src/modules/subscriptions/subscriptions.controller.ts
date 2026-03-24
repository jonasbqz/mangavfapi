import {
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOrApiKeyGuard } from '@/modules/auth/admin-or-api-key.guard';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('subscriptions/webhook')
  @ApiOperation({ summary: 'Handle Stripe subscription webhooks' })
  async handleStripeWebhook(
    @Req() request: FastifyRequest,
    @Headers('stripe-signature') signature?: string,
  ) {
    await this.subscriptionsService.handleWebhook(
      (request as any).rawBody,
      signature,
    );
    return { received: true };
  }

  @Post('admin/subscriptions/:profileId/resync')
  @UseGuards(AdminOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resync a profile subscription from Stripe' })
  async resyncSubscription(@Param('profileId') profileId: string) {
    return this.subscriptionsService.resyncProfileSubscription(profileId);
  }

  @Post('admin/subscriptions/:profileId/cancel')
  @UseGuards(AdminOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a profile subscription at period end' })
  async cancelSubscription(@Param('profileId') profileId: string) {
    return this.subscriptionsService.cancelSubscriptionAtPeriodEnd(profileId);
  }

  @Post('admin/subscriptions/:profileId/reactivate')
  @UseGuards(AdminOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a profile subscription before period end' })
  async reactivateSubscription(@Param('profileId') profileId: string) {
    return this.subscriptionsService.reactivateSubscription(profileId);
  }
}
