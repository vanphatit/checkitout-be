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
  ) {}

  async addSeat(createSeatDto: CreateSeatDto) {
    // 1. Tìm Bus trước để đảm bảo Bus tồn tại
    const bus = await this.busModel.findById(createSeatDto.busId);
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Tạo và Lưu Seat (Lưu bên thứ 1: Collection Seats)
    // Loại bỏ busId khỏi dto nếu Seat entity không cần lưu ngược lại busId
    const newSeat = new this.seatModel({
      seatNo: createSeatDto.seatNo,
      status: createSeatDto.status,
    });

    const savedSeat = await newSeat.save();
    // 3. Cập nhật Bus (Lưu bên thứ 2: Collection Buses)
    await this.busModel.findByIdAndUpdate(
      createSeatDto.busId,
      { $push: { seats: savedSeat._id } },
      { new: true },
    );

    return {
      message: 'Seat added and linked successfully',
      seat: savedSeat,
    };
  }

  async getSeats(busId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Bước 1: Tìm Bus để lấy danh sách ID ghế
    const bus = await this.busModel.findById(busId).select('seats');
    if (!bus) throw new NotFoundException('Bus not found');

    // Bước 2: Query trực tiếp vào bảng Seat dựa trên danh sách ID đó
    const seats = await this.seatModel
      .find({
        _id: { $in: bus.seats }, // Chỉ tìm những ghế thuộc xe này
      })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = bus.seats.length;

    return {
      data: seats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateSeatsBySeller(
    busId: string,
    seatNos: string[],
    status: SeatStatus,
  ) {
    const bus = await this.busModel.findById(busId).select('seats');
    if (!bus) throw new NotFoundException('Bus not found');

    // Seller có quyền ghi đè mọi trạng thái (kể cả SOLD)
    const result = await this.seatModel.updateMany(
      {
        seatNo: { $in: seatNos },
        _id: { $in: bus.seats }, // Vẫn phải check scope để không sửa nhầm xe khác
      },
      {
        $set: { status: status },
      },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('No valid seats found to update');
    }

    return {
      message: 'Seats status updated by Seller successfully',
      updatedCount: result.modifiedCount,
    };
  }

  async reserveSeatsByCustomer(busId: string, seatNos: string[]) {
    // 1. Khách hàng chỉ được phép chuyển sang trạng thái PENDING (Giữ chỗ)
    // Không cho phép khách gửi status = SOLD trực tiếp
    const targetStatus = SeatStatus.PENDING;

    const bus = await this.busModel.findById(busId).select('seats');
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Update có điều kiện (Atomic Update)
    // Chỉ update những ghế thoả mãn 3 điều kiện:
    // - Đúng số ghế (seatNo)
    // - Thuộc đúng xe (_id)
    // - VÀ ĐANG TRỐNG (status: EMPTY) -> Đây là chốt chặn quan trọng nhất
    const result = await this.seatModel.updateMany(
      {
        seatNo: { $in: seatNos },
        _id: { $in: bus.seats },
        status: SeatStatus.EMPTY, // KHÔNG được đụng vào ghế SOLD hoặc PENDING
      },
      {
        $set: { status: targetStatus },
      },
    );

    return {
      message: 'Seats reserved successfully',
      bookedSeats: seatNos,
      status: targetStatus,
    };
  }

  async getSeatByBusIdAndSeatNo(busId: string, seatNo: string) {
    // Tìm Bus để lấy danh sách các ID ghế thuộc về xe này
    const bus = await this.busModel.findById(busId).select('seats');

    if (!bus) {
      throw new NotFoundException('Bus not found');
    }

    // Tìm trong collection Seat với 2 điều kiện:
    // 1. seatNo trùng khớp
    // 2. _id của ghế PHẢI nằm trong danh sách ghế của xe (để tránh lấy nhầm ghế xe khác)
    const seat = await this.seatModel.findOne({
      seatNo: seatNo,
      _id: { $in: bus.seats },
    });

    if (!seat) {
      throw new NotFoundException(
        `Seat number ${seatNo} not found in this bus`,
      );
    }

    return seat;
  }

  async getSeatByBusIdAndSeatId(busId: string, seatId: string) {
    // Tìm xe để lấy danh sách các ID ghế hợp lệ
    const bus = await this.busModel.findById(busId).select('seats');
    if (!bus) {
      throw new NotFoundException('Bus not found');
    }

    //  Kiểm tra xem seatId được truyền vào có nằm trong danh sách ghế của xe này không
    const isSeatInBus = bus.seats.some((sId) => sId.toString() === seatId);

    if (!isSeatInBus) {
      throw new NotFoundException('Seat ID does not belong to this Bus');
    }

    // Lấy thông tin chi tiết ghế
    const seat = await this.seatModel.findById(seatId);

    if (!seat) {
      throw new NotFoundException('Seat not found');
    }

    return seat;
  }
}
