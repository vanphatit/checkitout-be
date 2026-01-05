import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Req,
  Res,
  BadRequestException,
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
import { TicketService } from './ticket.service';
import { CreateTicketDto } from '../ticket/dto/create-ticket.dto';
import { UpdateTicketStatusDto } from '../ticket/dto/update-ticket-status.dto';
import { TransferTicketDto } from '../ticket/dto/transfer-ticket.dto';
import { TicketQueryDto } from '../ticket/dto/ticket-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { TicketStatus } from './enums/ticket-status.enum';

@ApiTags('Ticket')
@Controller('ticket')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new ticket',
    description: `
      - Customer: Auto-uses their phone from JWT token
      - Admin/Seller: Must provide customer phone in request body
      - Auto-creates PRE_REGISTERED user if phone doesn't exist
      - Automatically applies the best promotion for the scheduling date
      - Ticket expires 3 hours before departure
    `,
  })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Seat unavailable or invalid data',
  })
  async create(@Body() dto: CreateTicketDto, @Req() req: any) {
    const userRole = req.user.role;
    const userPhone = req.user.phone;

    // Determine customer phone based on role
    let customerPhone: string;

    if (userRole === UserRole.CUSTOMER) {
      // Customer creates ticket for themselves
      if (!userPhone) {
        throw new BadRequestException(
          'Customer must have a phone number registered',
        );
      }
      customerPhone = userPhone;
    } else if (userRole === UserRole.ADMIN || userRole === UserRole.SELLER) {
      // Admin/Seller creates ticket for customer - phone must be provided
      if (!dto.phone) {
        throw new BadRequestException('Phone is required to create ticket');
      }
      customerPhone = dto.phone;
    } else {
      throw new BadRequestException('Invalid user role');
    }

    return this.ticketService.create({ ...dto, phone: customerPhone });
  }

  @Post('create-and-pay')
  @ApiOperation({
    summary: 'Create ticket and generate payment URL in one step',
    description: `
      - Customer: Auto-uses their phone from JWT token
      - Admin/Seller: Must provide customer phone in request body
      - Auto-creates PRE_REGISTERED user if phone doesn't exist
      - Creates ticket and immediately returns VNPay payment URL
      - User should redirect to paymentUrl to complete payment
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Ticket created and payment URL generated',
    schema: {
      example: {
        ticket: {
          _id: '507f1f77bcf86cd799439011',
          status: 'Pending',
          totalPrice: 225000,
          userId: { firstName: 'John', lastName: 'Doe', phone: '+1234567890' },
          seatId: { seatNo: 'B14' },
        },
        payment: {
          success: true,
          paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
          transactionId: 'TICKET_507f1f77bcf86cd799439011_1704369845',
          amount: 225000,
          expiredTime: '2025-08-29T11:20:00.000Z',
        },
        message: 'Ticket created. Redirect to paymentUrl to complete payment.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Seat unavailable or invalid data',
  })
  async createAndPay(@Body() dto: CreateTicketDto, @Req() req: any) {
    const userRole = req.user.role;
    const userPhone = req.user.phone;

    // Determine customer phone based on role
    let customerPhone: string;

    if (userRole === UserRole.CUSTOMER) {
      if (!userPhone) {
        throw new BadRequestException(
          'Customer must have a phone number registered',
        );
      }
      customerPhone = userPhone;
    } else if (userRole === UserRole.ADMIN || userRole === UserRole.SELLER) {
      if (!dto.phone) {
        throw new BadRequestException('Phone is required to create ticket');
      }
      customerPhone = dto.phone;
    } else {
      throw new BadRequestException('Invalid user role');
    }

    // 1. Create ticket
    const ticket = await this.ticketService.create({
      ...dto,
      phone: customerPhone,
    });

    if (!ticket || !ticket._id) {
      throw new Error('Failed to create ticket');
    }

    // 2. Generate payment URL
    const ipAddr = (req.ip ||
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1') as string;

    const ticketId = String(ticket._id);
    const payment = await this.ticketService.createPaymentUrl(ticketId, ipAddr);

    return {
      ticket,
      payment,
      message: 'Ticket created. Redirect to paymentUrl to complete payment.',
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({ summary: 'List all tickets (Admin/Seller only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    description: 'Filter by customer email',
  })
  @ApiQuery({
    name: 'phone',
    required: false,
    type: String,
    description: 'Filter by customer phone',
  })
  @ApiQuery({ name: 'schedulingId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiResponse({ status: 200, description: 'Paginated tickets list' })
  findAll(@Query() query: TicketQueryDto) {
    return this.ticketService.findAll(query);
  }

  @Get('my-tickets')
  @ApiOperation({
    summary: "Get current user's tickets",
    description:
      'Returns all tickets belonging to the authenticated user (based on their email)',
  })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiResponse({ status: 200, description: 'User tickets' })
  getMyTickets(@Req() req: any, @Query('status') status?: TicketStatus) {
    const userEmail = req.user.email;
    if (!userEmail) {
      throw new BadRequestException('User must have an email registered');
    }
    return this.ticketService.getUserTicketsByEmail(userEmail, status);
  }

  @Get('by-email/:email')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Get tickets by email (Admin/Seller only)',
    description: 'Returns all tickets for a specific customer email',
  })
  @ApiParam({
    name: 'email',
    description: 'Customer email',
    example: 'customer@example.com',
  })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiResponse({ status: 200, description: 'Tickets for customer' })
  getTicketsByEmail(
    @Param('email') email: string,
    @Query('status') status?: TicketStatus,
  ) {
    return this.ticketService.getUserTicketsByEmail(email, status);
  }

  @Get('by-phone/:phone')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Get tickets by phone (Admin/Seller only)',
    description: 'Returns all tickets for a specific customer phone number',
  })
  @ApiParam({
    name: 'phone',
    description: 'Customer phone',
    example: '0901234567',
  })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiResponse({ status: 200, description: 'Tickets for customer' })
  getTicketsByPhone(
    @Param('phone') phone: string,
    @Query('status') status?: TicketStatus,
  ) {
    return this.ticketService.getUserTicketsByPhone(phone, status);
  }

  @Get('scheduling/:schedulingId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Get tickets by scheduling (Admin/Seller only)',
    description: 'Returns all tickets for a specific scheduling',
  })
  @ApiParam({ name: 'schedulingId', description: 'Scheduling ID' })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiResponse({ status: 200, description: 'Tickets for scheduling' })
  getTicketsByScheduling(
    @Param('schedulingId') schedulingId: string,
    @Query('status') status?: TicketStatus,
  ) {
    return this.ticketService.getTicketsByScheduling(schedulingId, status);
  }

  @Get('preview/:schedulingId')
  @ApiOperation({
    summary: 'Calculate price preview',
    description:
      'Preview the final price including promotion before creating a ticket',
  })
  @ApiParam({ name: 'schedulingId', description: 'Scheduling ID' })
  @ApiResponse({
    status: 200,
    description: 'Price preview with promotion details',
  })
  calculatePreview(@Param('schedulingId') schedulingId: string) {
    return this.ticketService.calculatePricePreview(schedulingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({
    status: 200,
    description: 'Ticket details with populated data',
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id') id: string) {
    return this.ticketService.findOne(id);
  }

  @Get(':id/qrcode')
  @ApiOperation({
    summary: 'Generate QR code for ticket',
    description:
      'Generate QR code containing ticket information. Returns QR code as PNG image.',
  })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({
    status: 200,
    description: 'QR code image',
    content: {
      'image/png': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async generateQRCode(@Param('id') id: string, @Res() res: Response) {
    const qrBuffer = await this.ticketService.generateQRCode(id);
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': qrBuffer.length,
    });
    res.send(qrBuffer);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Update ticket status (Admin/Seller only)',
    description: `
      - Confirm payment (PENDING -> SUCCESS) or fail ticket (PENDING -> FAILED)
      - Can update payment method to CASH if needed
    `,
  })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.ticketService.updateStatus(id, dto);
  }

  @Post(':id/transfer')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Transfer ticket to another scheduling (Seller only)',
    description:
      'Transfer must be at least 3 hours before departure. Same route and price required. Old ticket becomes TRANSFER, new ticket becomes SUCCESS.',
  })
  @ApiParam({ name: 'id', description: 'Old Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket transferred successfully' })
  @ApiResponse({
    status: 400,
    description: 'Transfer not allowed or invalid data',
  })
  transfer(@Param('id') id: string, @Body() dto: TransferTicketDto) {
    return this.ticketService.transfer(id, dto);
  }

  @Post(':id/fail')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Manually fail a ticket (Admin/Seller only)',
    description: 'Cancel a PENDING ticket manually',
  })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket failed' })
  failTicket(@Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.ticketService.failTicket(id, body?.reason);
  }

  @Post('cancel-expired')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cancel all expired tickets (Admin only)',
    description:
      'Manually trigger expired ticket cancellation. Should normally be run by cron job.',
  })
  @ApiResponse({ status: 200, description: 'Expired tickets cancelled' })
  cancelExpired() {
    return this.ticketService.cancelExpiredTickets();
  }
  // ============================================
  // ANALYTICS ENDPOINTS - Add to TicketController class
  // ============================================

  @Get('analytics/scheduling/:schedulingId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Get revenue analytics by scheduling (Admin/Seller only)',
    description:
      'Revenue breakdown for a specific scheduling with occupancy rate and seat details',
  })
  @ApiParam({ name: 'schedulingId', description: 'Scheduling ID' })
  @ApiResponse({
    status: 200,
    description: 'Scheduling revenue analytics',
    schema: {
      example: {
        schedulingId: '507f1f77bcf86cd799439011',
        route: {
          name: 'Hà Nội - Hải Phòng',
          routeId: '507f1f77bcf86cd799439012',
        },
        bus: {
          licensePlate: '29A-12345',
          capacity: 40,
          busId: '507f1f77bcf86cd799439013',
        },
        scheduling: {
          departureDate: '2025-08-29T14:20:00.000Z',
          arrivalDate: '2025-08-29T17:30:00.000Z',
          etd: '14:20',
          eta: '17:30',
          status: 'scheduled',
        },
        totalRevenue: 4500000,
        ticketCount: 20,
        occupancyRate: 50,
        availableSeats: 20,
        averageTicketPrice: 225000,
        byPaymentMethod: {
          BANKING: { count: 15, revenue: 3375000 },
          CASH: { count: 5, revenue: 1125000 },
        },
        ticketDetails: [
          {
            seatNo: 'A1',
            price: 225000,
            paymentMethod: 'BANKING',
            paidAt: '2025-08-28T10:30:00.000Z',
          },
          {
            seatNo: 'A2',
            price: 225000,
            paymentMethod: 'CASH',
            paidAt: '2025-08-28T11:45:00.000Z',
          },
        ],
      },
    },
  })
  getRevenueByScheduling(@Param('schedulingId') schedulingId: string) {
    return this.ticketService.getRevenueByScheduling(schedulingId);
  }

  @Get('analytics/dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Get dashboard summary (Admin/Seller only)',
    description:
      'Overview of revenue and ticket counts for today, this month, this year, and all time',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary',
    schema: {
      example: {
        today: { revenue: 450000, ticketCount: 2 },
        thisMonth: { revenue: 5400000, ticketCount: 24 },
        thisYear: { revenue: 45000000, ticketCount: 200 },
        allTime: { revenue: 150000000, ticketCount: 850 },
        pending: { ticketCount: 5 },
      },
    },
  })
  getDashboardSummary() {
    return this.ticketService.getDashboardSummary();
  }

  @Get('analytics/today')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Get revenue analytics for today (Admin/Seller only)',
    description:
      'Revenue breakdown for current day with payment method details',
  })
  @ApiResponse({
    status: 200,
    description: "Today's revenue analytics",
    schema: {
      example: {
        date: '2025-01-04',
        totalRevenue: 450000,
        ticketCount: 2,
        averageTicketPrice: 225000,
        byPaymentMethod: {
          BANKING: { count: 1, revenue: 225000 },
          CASH: { count: 1, revenue: 225000 },
        },
      },
    },
  })
  getRevenueToday() {
    return this.ticketService.getRevenueToday();
  }

  @Get('analytics/tickets-list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({
    summary: 'Get detailed ticket list with filters (Admin/Seller only)',
    description:
      'Get paginated ticket list with analytics filters for UI display',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['today', 'thisMonth', 'thisYear', 'allTime', 'custom'],
    description: 'Time period filter',
    example: 'thisMonth',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for custom period (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for custom period (YYYY-MM-DD)',
    example: '2026-01-31',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TicketStatus,
    description: 'Filter by ticket status (default: SUCCESS)',
  })
  @ApiQuery({
    name: 'paymentMethod',
    required: false,
    type: String,
    description: 'Filter by payment method (BANKING/CASH)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Detailed ticket list with summary',
    schema: {
      example: {
        summary: {
          totalRevenue: 897051,
          ticketCount: 3,
          averageTicketPrice: 299017,
        },
        byPaymentMethod: {
          BANKING: { count: 1, revenue: 299017 },
          CASH: { count: 2, revenue: 598034 },
        },
        tickets: [
          {
            _id: '695a2fd3add1938d601c8260',
            totalPrice: 299017,
            paymentMethod: 'CASH',
            status: 'SUCCESS',
            createdAt: '2026-01-04T09:16:03.398Z',
            updatedAt: '2026-01-04T09:16:03.398Z',
            user: {
              name: 'Usha Buyer',
              email: 'user5@checkitout.com',
              phone: '+30000000005',
            },
            seat: 'B8',
            scheduling: {
              departureDate: '2026-01-05T03:31:34.884Z',
              etd: '18:00',
            },
            promotion: {
              name: 'Ngày thường - Regular Day',
              value: 0,
            },
          },
        ],
        pagination: {
          total: 3,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    },
  })
  getTicketsWithAnalytics(
    @Query('period')
    period?: 'today' | 'thisMonth' | 'thisYear' | 'allTime' | 'custom',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: TicketStatus,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ticketService.getTicketsWithAnalytics({
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
      paymentMethod,
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 10,
    });
  }
}
