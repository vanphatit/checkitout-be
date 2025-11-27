import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
}
