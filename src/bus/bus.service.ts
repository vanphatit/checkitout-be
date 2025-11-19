import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bus, BusDocument } from '../bus/entities/bus.entity';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ExcelService } from '../common/excel/excel.service';
import { BusExcelRow } from './type/bus-excel-row.type';
import { BusStatus } from '../bus/enums/bus-status.enum';
import { BusType } from './enums/bus-type.enum';

@Injectable()
export class BusService {
  constructor(
    @InjectModel(Bus.name) private busModel: Model<BusDocument>,
    private readonly excelService: ExcelService,
  ) {}
  async create(createBusDto: CreateBusDto): Promise<Bus> {
    const bus = new this.busModel(createBusDto);
    return bus.save();
  }

  async importFromExcel(filePath: string): Promise<Bus[]> {
    const rows: BusExcelRow[] =
      await this.excelService.importExcel<BusExcelRow>(
        filePath,
        async (dto) => await Promise.resolve(dto),
        {
          requiredFields: ['busNo', 'plateNo', 'driverName'],
          transform: (row) => ({
            vacancy: Number(row.vacancy ?? 0),
            status: (row.status as BusStatus) ?? BusStatus.AVAILABLE,
            type: (row.type as BusType) ?? BusType.SLEEPER,
          }),
        },
      );
    const busNos = rows.map((r) => r.busNo);
    const existingBuses = await this.busModel.find({ busNo: { $in: busNos } });
    const existingBusNos = new Set(existingBuses.map((b) => b.busNo));

    const busesToInsert = rows
      .filter((r) => !existingBusNos.has(r.busNo))
      .map((r) => ({
        ...r,
        vacancy: Number(r.vacancy ?? 0),
        status: (r.status as BusStatus) ?? BusStatus.AVAILABLE,
        type: (r.type as BusType) ?? BusType.SLEEPER,
        images: r.images ? r.images.map(String) : [],
      }));

    if (busesToInsert.length === 0) {
      throw new NotFoundException(
        'No new buses to import, all busNos already exist',
      );
    }

    return this.busModel.insertMany(busesToInsert);
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<{ data: Bus[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.busModel.find().skip(skip).limit(limit).exec(),
      this.busModel.countDocuments(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Bus> {
    const bus = await this.busModel.findById(id);
    if (!bus) throw new NotFoundException('Bus not found');
    return bus;
  }

  async update(id: string, updateBusDto: UpdateBusDto): Promise<Bus> {
    const bus = await this.busModel.findByIdAndUpdate(id, updateBusDto, {
      new: true,
    });
    if (!bus) throw new NotFoundException('Bus not found');
    return bus;
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
}
