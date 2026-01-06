import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Bus, BusDocument, BusImage } from '../bus/entities/bus.entity';
import { BusImageDto, CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { ExcelService } from '../common/excel/excel.service';
import { BusExcelRow } from './type/bus-excel-row.type';
import { BusStatus } from '../bus/enums/bus-status.enum';
import { BusType } from './enums/bus-type.enum';
import { PaginationDto } from './dto/bus-pagination.dto';
import { SortOrder } from 'mongoose';
import { Seat } from 'src/seat/entities/seat.entity';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { BusUpdatedEvent } from '../common/events/scheduling-reindex.event';

@Injectable()
export class BusService {
  constructor(
    @InjectModel(Bus.name) private busModel: Model<BusDocument>,
    @InjectModel(Seat.name) private seatModel: Model<Seat>,

    private readonly excelService: ExcelService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly eventEmitter: EventEmitter2,
  ) { }
  async create(createBusDto: CreateBusDto): Promise<Bus> {
    const bus = new this.busModel(createBusDto);
    return bus.save();
  }

  private generateSeats(type: BusType): Partial<Seat>[] {
    const seats: Partial<Seat>[] = [];

    if (type === BusType.SLEEPER) {
      for (let i = 1; i <= 17; i++) {
        seats.push({ seatNo: `A${i}` });
        seats.push({ seatNo: `B${i}` });
      }
    } else if (type === BusType.SEATER) {
      for (let i = 1; i <= 28; i++) {
        seats.push({ seatNo: `${i}` });
      }
    }

    return seats;
  }

  async createWithSeats(createBusDto: CreateBusDto): Promise<Bus> {
    try {
      // 1. Tạo bus trước, chưa gán seats
      const images: BusImage[] = (createBusDto.images || []).map((img) => ({
        url: img.url,
        publicId: img.publicId,
      }));

      const bus = new this.busModel({
        ...createBusDto,
        vacancy: 0,
        images,
        seats: [],
      });

      const savedBus = await bus.save(); // bây giờ có _id

      // 2. Tạo seat với busId
      const seatsData = this.generateSeats(createBusDto.type).map((seat) => ({
        ...seat,
        busId: savedBus._id, // bắt buộc
      }));

      const seats = await this.seatModel.insertMany(seatsData);
      const seatIds = seats.map((seat) => seat._id);

      // 3. Update bus với seatIds và vacancy
      savedBus.seats = seatIds;
      savedBus.vacancy = seats.length;

      return await savedBus.save();
    } catch (err) {
      console.error('Error creating bus:', err);
      throw err;
    }
  }

  // async importFromExcel(filePath: string): Promise<Bus[]> {
  //   const rows: BusExcelRow[] =
  //     await this.excelService.importExcel<BusExcelRow>(
  //       filePath,
  //       async (dto) => await Promise.resolve(dto),
  //       {
  //         requiredFields: ['busNo', 'plateNo', 'driverName'],
  //         transform: (row) => ({
  //           vacancy: Number(row.vacancy ?? 0),
  //           status: (row.status as BusStatus) ?? BusStatus.AVAILABLE,
  //           type: (row.type as BusType) ?? BusType.SLEEPER,
  //         }),
  //       },
  //     );
  //   const busNos = rows.map((r) => r.busNo);
  //   const existingBuses = await this.busModel.find({ busNo: { $in: busNos } });
  //   const existingBusNos = new Set(existingBuses.map((b) => b.busNo));

  //   const busesToInsert = rows
  //     .filter((r) => !existingBusNos.has(r.busNo))
  //     .map((r) => ({
  //       ...r,
  //       vacancy: Number(r.vacancy ?? 0),
  //       status: (r.status as BusStatus) ?? BusStatus.AVAILABLE,
  //       type: (r.type as BusType) ?? BusType.SLEEPER,
  //       images: r.images ? r.images.map(String) : [],
  //     }));

  //   if (busesToInsert.length === 0) {
  //     throw new NotFoundException(
  //       'No new buses to import, all busNos already exist',
  //     );
  //   }

  //   return this.busModel.insertMany(busesToInsert);
  // }

  async findAll(dto: PaginationDto): Promise<{
    data: Bus[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, type, status, search, sortBy, sortOrder } = dto;

    const skip = (page - 1) * limit;

    const filter: any = {};

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    // ===== SEARCH (driverName) =====
    if (search) {
      filter.driverName = {
        $regex: search,
        $options: 'i', // không phân biệt hoa thường
      };
    }

    // ===== SORT =====
    const sort: Record<string, SortOrder> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const [data, total] = await Promise.all([
      this.busModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.busModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Bus> {
    const bus = await this.busModel.findById(id);
    if (!bus) throw new NotFoundException('Bus not found');
    return bus;
  }

  async update(
    id: string,
    updateBusDto: UpdateBusDto,
    newImages?: Express.Multer.File[],
  ): Promise<Bus> {
    // 1. Lấy bus hiện tại
    const bus = await this.busModel.findById(id);
    if (!bus) throw new NotFoundException('Bus not found');

    // 2. Handle ảnh mới
    if (newImages && newImages.length > 0) {
      const maxImages = 5;
      const currentCount = bus.images.length;
      const remaining = maxImages - currentCount;

      if (remaining <= 0) {
        throw new BadRequestException(`Bus đã có tối đa ${maxImages} ảnh`);
      }

      // Nếu số ảnh mới > remaining → chỉ upload remaining tấm
      const filesToUpload = newImages.slice(0, remaining);

      // Upload lên Cloudinary (giả sử bạn có service uploadFiles)
      const uploadedImages = await this.cloudinaryService.uploadFiles(
        filesToUpload,
        'buses',
      );

      // Gộp ảnh cũ + ảnh mới
      bus.images = [...bus.images, ...uploadedImages];
    }

    // 3. Update các field khác
    Object.assign(bus, updateBusDto);

    // 4. Lưu lại
    const updatedBus = await bus.save();

    // 5. Emit event để reindex schedulings liên quan
    this.eventEmitter.emit('bus.updated', new BusUpdatedEvent(id));

    return updatedBus;
  }

  async removeImage(busId: string, publicId: string): Promise<Bus> {
    const bus = await this.busModel.findById(busId);
    if (!bus) throw new NotFoundException('Bus not found');

    // Kiểm tra ảnh có tồn tại trong bus không
    const imageIndex = bus.images.findIndex(img => img.publicId === publicId);
    if (imageIndex === -1) {
      throw new BadRequestException('Image không tồn tại trên bus');
    }

    // 1. Xóa ảnh trên Cloudinary
    await this.cloudinaryService.deleteFile(publicId);

    // 2. Xóa ảnh trong bus.images
    bus.images.splice(imageIndex, 1);

    return await bus.save();
  }


  async updateStatus(id: string, status: BusStatus): Promise<Bus> {
    const bus = await this.busModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );

    if (!bus) {
      throw new NotFoundException('Bus not found');
    }

    return bus;
  }

  async remove(id: string): Promise<void> {
    const bus = await this.busModel.findByIdAndDelete(id);
    if (!bus) throw new NotFoundException('Bus not found');
  }

  async getBusStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const result = await this.busModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    let active = 0;
    let inactive = 0;

    for (const item of result) {
      if (item._id === BusStatus.AVAILABLE) active = item.count;
      if (item._id === BusStatus.UNAVAILABLE) inactive = item.count;
    }

    return {
      total: active + inactive,
      active,
      inactive,
    };
  }
}
