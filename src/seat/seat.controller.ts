import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SeatService } from './seat.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/enums/user-role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateSeatStatusDto } from './dto/update-status.dto';
import { BookSeatDto } from './dto/book-seat.dto';

@Controller('/seats')
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  addSeat(@Body() createSeatDto: CreateSeatDto) {
    return this.seatService.addSeat(createSeatDto);
  }

  @Get('/bus/:busId')
  findAll(
    @Param('busId') busId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.seatService.getSeats(busId, paginationDto);
  }

  @Get('bus/:busId/seat/:seatNo')
  async getSeat(
    @Param('busId') busId: string,
    @Param('seatNo') seatNo: string,
  ) {
    return this.seatService.getSeatByBusIdAndSeatNo(busId, seatNo);
  }

  @Get(':busId/seat-details/:seatId')
  async getSeatDetails(
    @Param('busId') busId: string,
    @Param('seatId') seatId: string,
  ) {
    return this.seatService.getSeatByBusIdAndSeatId(busId, seatId);
  }

  @Patch(':busId/seats/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  async updateStatusBySeller(
    @Param('busId') busId: string,
    @Body() dto: UpdateSeatStatusDto,
  ) {
    return this.seatService.updateSeatsBySeller(busId, dto.seatNos, dto.status);
  }

  @Post(':busId/seats/book')
  async bookSeats(@Param('busId') busId: string, @Body() dto: BookSeatDto) {
    return this.seatService.reserveSeatsByCustomer(busId, dto.seatNos);
  }
}
