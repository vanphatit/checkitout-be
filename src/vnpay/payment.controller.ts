import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Req,
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
import type { Request } from 'express';
import { TicketService } from '../ticket/ticket.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly ticketService: TicketService) {}

  /**
   * Tạo VNPay payment URL cho ticket
   * Logic: Lấy thông tin ticket từ database -> Tạo payment URL
   */
  @Post('create/:ticketId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create VNPay payment URL',
    description:
      'Generate VNPay payment URL for PENDING ticket. Returns payment URL to redirect user.',
  })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Payment URL created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Ticket not in PENDING status or expired',
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async createPaymentUrl(
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
  ) {
    // Get client IP address
    const ipAddr = (req.ip ||
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      '127.0.0.1') as string;

    // Logic thực tế: Lấy ticket từ DB và tạo payment URL
    // Không hardcode gì cả, mọi thứ đều từ database
    return await this.ticketService.createPaymentUrl(ticketId, ipAddr);
  }

  /**
   * VNPay callback endpoint
   * Logic: Verify signature -> Lấy ticket từ transactionId -> Update status -> Return full ticket data
   */
  @Get('vnpay-return')
  @ApiOperation({
    summary: 'VNPay callback endpoint',
    description:
      'Endpoint for VNPay to callback after payment. Returns payment result and ticket info from database.',
  })
  @ApiQuery({
    name: 'vnp_TxnRef',
    required: true,
    description: 'Transaction Reference',
  })
  @ApiQuery({
    name: 'vnp_ResponseCode',
    required: true,
    description: 'Response Code (00 = success)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment result with full ticket data from database',
  })
  @ApiResponse({ status: 400, description: 'Invalid signature or bad request' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async vnpayReturn(@Query() query: any) {
    // Logic thực tế:
    // 1. Verify VNPay signature
    // 2. Tìm ticket trong DB bằng transactionId (từ vnp_TxnRef)
    // 3. Update ticket status, payment info
    // 4. Create snapshot nếu chưa có
    // 5. Update seat status
    // 6. Return FULL ticket data từ DB với populate đầy đủ
    //
    // → Không có hardcode data nào cả!
    return await this.ticketService.handleVNPayCallback(query);
  }

  /**
   * Get payment status của ticket
   * Logic: Lấy ticket từ DB theo ticketId -> Return payment info
   */
  @Get('status/:ticketId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get payment status',
    description: 'Check payment status of a ticket from database',
  })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Payment status from database' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getPaymentStatus(@Param('ticketId') ticketId: string) {
    // Logic thực tế: Query ticket từ DB theo ticketId
    // Return payment status và info từ database
    return await this.ticketService.getPaymentStatus(ticketId);
  }
}
