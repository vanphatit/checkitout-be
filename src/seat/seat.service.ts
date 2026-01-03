import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bus, BusDocument } from '../bus/entities/bus.entity';
import { CreateSeatDto } from './dto/create-seat.dto';
import { SeatStatus } from './enums/seat-status.enum';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Seat, SeatDocument } from './entities/seat.entity';

@Injectable()
export class SeatService {
  constructor(
    @InjectModel(Bus.name) private busModel: Model<BusDocument>,
    @InjectModel(Seat.name) private seatModel: Model<SeatDocument>,
  ) { }

  async addSeat(createSeatDto: CreateSeatDto) {
    const bus = await this.busModel.findById(createSeatDto.busId);
    if (!bus) throw new NotFoundException('Bus not found');

    const newSeat = new this.seatModel({
      seatNo: createSeatDto.seatNo,
      busId: bus._id,
    });

    const savedSeat = await newSeat.save();

    return {
      message: 'Seat created successfully',
      seat: savedSeat,
    };
  }

  async getSeats(busId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // 1. Kiểm tra bus tồn tại
    const bus = await this.busModel.findById(busId);
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Lấy danh sách seat trực tiếp theo busId
    const seats = await this.seatModel
      .find({ busId: bus._id })
      .skip(skip)
      .limit(limit)
      .exec();

    // 3. Tổng số ghế của bus
    const total = await this.seatModel.countDocuments({ busId: bus._id });

    return {
      data: seats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async sellSeatsBySeller(busId: string, seatNos: string[]) {
    console.log('Selling seats:', seatNos);
    // 1. Kiểm tra bus tồn tại
    const bus = await this.busModel.findById(busId);
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Update ghế: chỉ những ghế đang EMPTY mới được bán
    const result = await this.seatModel.updateMany(
      {
        busId: bus._id,
        seatNo: { $in: seatNos },
        status: SeatStatus.EMPTY, // chỉ ghế trống mới bán
      },
      { $set: { status: SeatStatus.SOLD } },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('No available seats to sell');
    }

    return {
      message: 'Seats sold successfully by Seller',
      soldSeats: seatNos,
      updatedCount: result.modifiedCount,
      status: SeatStatus.SOLD,
    };
  }

  async reserveSeatsByCustomer(busId: string, seatNos: string[]) {
    const targetStatus = SeatStatus.PENDING;

    // 1. Kiểm tra bus tồn tại
    const bus = await this.busModel.findById(busId);
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Update atomic: chỉ update ghế EMPTY
    const result = await this.seatModel.updateMany(
      {
        busId: bus._id,
        seatNo: { $in: seatNos },
        status: SeatStatus.EMPTY,
      },
      { $set: { status: targetStatus } },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('No seats available to reserve');
    }

    return {
      message: 'Seats reserved successfully',
      bookedSeats: seatNos,
      status: targetStatus,
    };
  }

  async confirmSeatsPayment(busId: string, seatNos: string[]) {
    const targetStatus = SeatStatus.SOLD;

    // 1. Kiểm tra bus tồn tại
    const bus = await this.busModel.findById(busId);
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Update atomic: chỉ update những ghế đang PENDING
    const result = await this.seatModel.updateMany(
      {
        busId: bus._id,
        seatNo: { $in: seatNos },
        status: SeatStatus.PENDING,
      },
      { $set: { status: targetStatus } },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('No seats found to confirm payment');
    }

    return {
      message: 'Seats confirmed and sold successfully',
      soldSeats: seatNos,
      status: targetStatus,
    };
  }

  async resetSeats(busId: string) {
    // 1. Kiểm tra bus tồn tại
    const bus = await this.busModel.findById(busId);
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Update tất cả ghế về EMPTY
    const result = await this.seatModel.updateMany(
      { busId: bus._id },
      { $set: { status: SeatStatus.EMPTY } },
    );

    return {
      message: 'All seats reset to EMPTY successfully',
      updatedCount: result.modifiedCount,
    };
  }

  async getSeatByBusIdAndSeatNo(busId: string, seatNo: string) {
    // 1. Kiểm tra bus tồn tại
    const bus = await this.busModel.findById(busId);
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Lấy ghế theo busId + seatNo
    const seat = await this.seatModel.findOne({
      seatNo: seatNo,
      busId: busId,
    });

    if (!seat) throw new NotFoundException('Seat not found in this Bus');

    return seat;
  }

  /**
   * Get seat by ID
   * Used by Ticket Service for validation and snapshot
   */
  async getSeatById(seatId: string): Promise<SeatDocument> {
    const seat = await this.seatModel.findById(seatId).exec();
    if (!seat) {
      throw new NotFoundException(`Seat with ID ${seatId} not found`);
    }
    return seat;
  }

  /**
   * Get seat for snapshot 
   * Used when building transaction snapshot
   */
  async getSeatForSnapshot(seatId: string) {
    const seat = await this.seatModel.findById(seatId).lean().exec();
    if (!seat) {
      throw new NotFoundException(`Seat with ID ${seatId} not found`);
    }
    return seat;
  }

  /**
   * Check if seat is available (EMPTY status) and belongs to the correct bus
   */
  async checkSeatAvailability(seatId: string, busId: string): Promise<void> {
    const seat = await this.getSeatById(seatId);

    // Validate seat belongs to the bus
    if (seat.busId.toString() !== busId) {
      throw new BadRequestException(
        `Seat ${seat.seatNo} does not belong to bus ${busId}`
      );
    }

    // Check if seat is available
    if (seat.status !== SeatStatus.EMPTY) {
      throw new BadRequestException(
        `Seat ${seat.seatNo} is not available (current status: ${seat.status})`
      );
    }
  }

  /**
   * Update single seat status by seatId
   */
  async updateSeatStatus(
    seatId: string, 
    newStatus: SeatStatus,
    expectedCurrentStatus?: SeatStatus
  ): Promise<SeatDocument> {
    const seat = await this.getSeatById(seatId);

    // Optional: validate current status before update
    if (expectedCurrentStatus && seat.status !== expectedCurrentStatus) {
      throw new BadRequestException(
        `Cannot update seat: expected status ${expectedCurrentStatus}, but found ${seat.status}`
      );
    }

    seat.status = newStatus;
    await seat.save();

    return seat;
  }

  /**
   * Reserve single seat (EMPTY → PENDING)
   */
  async reserveSeat(seatId: string, busId: string): Promise<SeatDocument> {
    // Check availability first
    await this.checkSeatAvailability(seatId, busId);

    // Update to PENDING
    return this.updateSeatStatus(
      seatId,
      SeatStatus.PENDING,
      SeatStatus.EMPTY // Must be EMPTY to reserve
    );
  }

  /**
   * Confirm seat payment (PENDING → SOLD)
   */
  async confirmSeat(seatId: string): Promise<SeatDocument> {
    return this.updateSeatStatus(
      seatId,
      SeatStatus.SOLD,
      SeatStatus.PENDING // Must be PENDING to confirm
    );
  }

  /**
   * Release seat (PENDING → EMPTY or SOLD → EMPTY)
   * Used when ticket fails or is cancelled
   */
  async releaseSeat(seatId: string): Promise<SeatDocument> {
    // Don't validate current status - allow release from any status
    return this.updateSeatStatus(seatId, SeatStatus.EMPTY);
  }

  /**
   * Bulk release seats (used by cron job)
   */
  async releaseSeats(seatIds: string[]): Promise<{ releasedCount: number }> {
    const result = await this.seatModel.updateMany(
      { _id: { $in: seatIds.map(id => new Types.ObjectId(id)) } },
      { $set: { status: SeatStatus.EMPTY } }
    );

    return {
      releasedCount: result.modifiedCount
    };
  }

  /**
   * Validate seat belongs to bus
   * Used in transfer ticket validation
   */
  async validateSeatBelongsToBus(seatId: string, busId: string): Promise<void> {
    const seat = await this.getSeatById(seatId);
    
    if (seat.busId.toString() !== busId) {
      throw new BadRequestException(
        `Seat ${seat.seatNo} does not belong to bus ${busId}`
      );
    }
  }

  /**
   * Get multiple seats by IDs (for bulk operations)
   */
  async getSeatsByIds(seatIds: string[]): Promise<SeatDocument[]> {
    const seats = await this.seatModel
      .find({ _id: { $in: seatIds.map(id => new Types.ObjectId(id)) } })
      .exec();

    if (seats.length !== seatIds.length) {
      throw new NotFoundException('One or more seats not found');
    }

    return seats;
  }
}