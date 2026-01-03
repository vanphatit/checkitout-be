import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
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
    description: 'Automatically applies the best promotion for the scheduling date. Ticket expires 3 hours before departure.'
  })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Seat unavailable or invalid data' })
  create(@Body() dto: CreateTicketDto) {
    return this.ticketService.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({ summary: 'List all tickets (Admin/Seller only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'schedulingId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiResponse({ status: 200, description: 'Paginated tickets list' })
  findAll(@Query() query: TicketQueryDto) {
    return this.ticketService.findAll(query);
  }

  @Get('my-tickets')
  @ApiOperation({ 
    summary: 'Get current user\'s tickets',
    description: 'Returns all tickets belonging to the authenticated user'
  })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiResponse({ status: 200, description: 'User tickets' })
  getMyTickets(
    @Request() req,
    @Query('status') status?: TicketStatus
  ) {
    return this.ticketService.getUserTickets(req.user.userId, status);
  }

  @Get('scheduling/:schedulingId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({ 
    summary: 'Get tickets by scheduling (Admin/Seller only)',
    description: 'Returns all tickets for a specific scheduling'
  })
  @ApiParam({ name: 'schedulingId', description: 'Scheduling ID' })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiResponse({ status: 200, description: 'Tickets for scheduling' })
  getTicketsByScheduling(
    @Param('schedulingId') schedulingId: string,
    @Query('status') status?: TicketStatus
  ) {
    return this.ticketService.getTicketsByScheduling(schedulingId, status);
  }

  @Get('preview/:schedulingId')
  @ApiOperation({ 
    summary: 'Calculate price preview',
    description: 'Preview the final price including promotion before creating a ticket'
  })
  @ApiParam({ name: 'schedulingId', description: 'Scheduling ID' })
  @ApiResponse({ status: 200, description: 'Price preview with promotion details' })
  calculatePreview(@Param('schedulingId') schedulingId: string) {
    return this.ticketService.calculatePricePreview(schedulingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket details with populated data' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id') id: string) {
    return this.ticketService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({ 
    summary: 'Update ticket status (Admin/Seller only)',
    description: 'Confirm payment (PENDING -> SUCCESS) or fail ticket (PENDING -> FAILED)'
  })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto
  ) {
    return this.ticketService.updateStatus(id, dto);
  }

  @Post(':id/transfer')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({ 
    summary: 'Transfer ticket to another scheduling (Seller only)',
    description: 'Transfer must be at least 3 hours before departure. Same route and price required. Old ticket becomes TRANSFER, new ticket becomes SUCCESS.'
  })
  @ApiParam({ name: 'id', description: 'Old Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket transferred successfully' })
  @ApiResponse({ status: 400, description: 'Transfer not allowed or invalid data' })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferTicketDto
  ) {
    return this.ticketService.transfer(id, dto);
  }

  @Post(':id/fail')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiOperation({ 
    summary: 'Manually fail a ticket (Admin/Seller only)',
    description: 'Cancel a PENDING ticket manually'
  })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket failed' })
  failTicket(
    @Param('id') id: string,
    @Body() body?: { reason?: string }
  ) {
    return this.ticketService.failTicket(id, body?.reason);
  }

  @Post('cancel-expired')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Cancel all expired tickets (Admin only)',
    description: 'Manually trigger expired ticket cancellation. Should normally be run by cron job.'
  })
  @ApiResponse({ status: 200, description: 'Expired tickets cancelled' })
  cancelExpired() {
    return this.ticketService.cancelExpiredTickets();
  }
}