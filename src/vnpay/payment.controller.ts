import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { TicketService } from '../ticket/ticket.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Tạo VNPay payment URL cho ticket
   */
  @Post('create/:ticketId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create VNPay payment URL' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  async createPaymentUrl(
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
  ) {
    const ipAddr = (req.ip ||
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      '127.0.0.1') as string;

    return this.ticketService.createPaymentUrl(ticketId, ipAddr);
  }

  /**
   * VNPay callback endpoint
   * → Verify signature
   * → Update ticket & payment
   * → Redirect về Frontend
   */
  @Get('vnpay-return')
  @ApiOperation({ summary: 'VNPay callback endpoint' })
  @ApiQuery({ name: 'vnp_TxnRef', required: true })
  @ApiQuery({ name: 'vnp_ResponseCode', required: true })
  async vnpayReturn(
    @Query() query: any,
    @Res({ passthrough: false }) res: Response,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';

    try {
      const result = await this.ticketService.handleVNPayCallback(query);
      const transactionId = query.vnp_TxnRef;

      if (result.success) {
        const ticketId = result.ticket?._id?.toString() || '';
        return res.redirect(
          `${frontendUrl}/payment/success?ticketId=${ticketId}&transactionId=${transactionId}`,
        );
      }

      return res.redirect(
        `${frontendUrl}/payment/failed?transactionId=${transactionId}&message=${encodeURIComponent(
          result.message || 'Payment failed',
        )}`,
      );
    } catch (error: any) {
      return res.redirect(
        `${frontendUrl}/payment/error?message=${encodeURIComponent(
          error?.message || 'Unknown error',
        )}`,
      );
    }
  }

  /**
   * Get payment status của ticket
   */
  @Get('status/:ticketId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get payment status' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  async getPaymentStatus(@Param('ticketId') ticketId: string) {
    return this.ticketService.getPaymentStatus(ticketId);
  }
}
