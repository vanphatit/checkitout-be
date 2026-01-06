import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketService } from './ticket.service';

@Injectable()
export class TicketCronService {
  private readonly logger = new Logger(TicketCronService.name);

  constructor(private readonly ticketService: TicketService) {}

  /**
   * Run every 5 minutes to cancel expired tickets
   * Cron expression: '0 0 5 * * * *' = every 5 minutes
   */
  @Cron('0 */5 * * * *')
  async handleExpiredTickets() {
    this.logger.log('🔄 Running expired ticket cancellation job...');

    try {
      const result = await this.ticketService.cancelExpiredTickets();

      if (result.count > 0) {
        this.logger.log(`✅ Cancelled ${result.count} expired tickets`);
      } else {
        this.logger.log('✅ No expired tickets found');
      }
    } catch (error) {
      this.logger.error('❌ Error cancelling expired tickets:', error);
    }
  }

  /**
   * Optional: Run daily cleanup for old FAILED tickets (e.g., delete after 30 days)
   * Cron expression: '0 0 2 * * *' = every day at 2:00 AM
   */
  @Cron('0 0 2 * * *')
  async cleanupOldFailedTickets() {
    this.logger.log('🧹 Running old failed tickets cleanup...');

    // TODO: Implement cleanup logic if needed
    // const thirtyDaysAgo = new Date();
    // thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.logger.log('✅ Cleanup completed');
  }
}
