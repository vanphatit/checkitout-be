import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as XLSX from 'xlsx';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SchedulingExcelRowDto,
  ExcelImportResultDto,
  ImportSchedulingExcelDto,
} from '../dto/excel-import.dto';
import { Route, RouteDocument } from '../../route/entities/route.entity';
import { Bus, BusDocument } from '../../bus/entities/bus.entity';

@Injectable()
export class ExcelProcessingService {
  constructor(
    @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
    @InjectModel(Bus.name) private busModel: Model<BusDocument>,
  ) { }
  /**
   * Parse Excel file buffer to JSON data
   */
  async parseExcelFile(buffer: Buffer): Promise<any[]> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new BadRequestException('File Excel không có sheet nào');
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Get raw data with row arrays
        defval: '', // Default value for empty cells
        blankrows: false, // Skip blank rows
      });

      if (jsonData.length < 2) {
        throw new BadRequestException(
          'File Excel phải có ít nhất 2 dòng (header + data)',
        );
      }

      // Convert to objects with proper field mapping
      const headers = this.mapExcelHeaders(jsonData[0] as string[]);
      const dataRows = jsonData.slice(1) as any[][];

      return dataRows
        .map((row, index) => {
          const obj: any = { rowIndex: index + 2 }; // +2 because Excel starts at 1 and we skip header

          headers.forEach((header, colIndex) => {
            if (header && row[colIndex] !== undefined) {
              obj[header] = row[colIndex];
            }
          });

          return obj;
        })
        .filter((row) => this.isRowNotEmpty(row));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Lỗi khi đọc file Excel: ${error.message}`);
    }
  }

  /**
   * Map Excel column headers to DTO field names
   */
  private mapExcelHeaders(headers: string[]): string[] {
    const headerMap: Record<string, string> = {
      // Vietnamese headers
      'tên tuyến': 'routeName',
      'tuyến đường': 'routeName',
      'tên tuyến đường': 'routeName',
      'biển số': 'plateNo',
      'biển số xe': 'plateNo',
      xe: 'plateNo',
      'ngày khởi hành': 'departureDate',
      'ngày đi': 'departureDate',
      ngày: 'departureDate',
      'giờ khởi hành': 'etd',
      'giờ đi': 'etd',
      etd: 'etd',
      'giờ đến': 'eta',
      eta: 'eta',
      giá: 'price',
      'giá vé': 'price',
      price: 'price',
      'tài xế': 'driverName',
      'tên tài xế': 'driverName',
      driver: 'driverName',
      'sđt tài xế': 'driverPhone',
      'điện thoại tài xế': 'driverPhone',
      phone: 'driverPhone',
      gplx: 'driverLicense',
      'bằng lái': 'driverLicense',
      license: 'driverLicense',
      'ghi chú': 'note',
      note: 'note',

      // English headers
      'route name': 'routeName',
      route: 'routeName',
      'plate number': 'plateNo',
      'bus plate': 'plateNo',
      'departure date': 'departureDate',
      date: 'departureDate',
      'departure time': 'etd',
      time: 'etd',
      'arrival time': 'eta',
      'driver name': 'driverName',
      'driver phone': 'driverPhone',
      'driver license': 'driverLicense',
    };

    return headers.map((header) => {
      if (!header) return '';
      const normalizedHeader = header.toString().toLowerCase().trim();
      return headerMap[normalizedHeader] || '';
    });
  }

  /**
   * Check if row has meaningful data
   */
  private isRowNotEmpty(row: any): boolean {
    const requiredFields = ['routeName', 'plateNo', 'departureDate', 'etd'];
    return requiredFields.some(
      (field) => row[field] && row[field].toString().trim() !== '',
    );
  }

  /**
   * Validate and transform Excel data to DTOs
   */
  async validateExcelData(rawData: any[]): Promise<{
    validRows: SchedulingExcelRowDto[];
    errors: Array<{ row: number; field?: string; message: string; data?: any }>;
  }> {
    const validRows: SchedulingExcelRowDto[] = [];
    const errors: Array<{
      row: number;
      field?: string;
      message: string;
      data?: any;
    }> = [];

    for (const rawRow of rawData) {
      try {
        // Transform and validate each row
        const dto = plainToClass(SchedulingExcelRowDto, rawRow, {
          excludeExtraneousValues: false,
          enableImplicitConversion: true,
        });

        const validationErrors = await validate(dto);

        if (validationErrors.length > 0) {
          // Collect validation errors
          for (const error of validationErrors) {
            errors.push({
              row: rawRow.rowIndex || 0,
              field: error.property,
              message: Object.values(error.constraints || {}).join(', '),
              data: rawRow,
            });
          }
        } else {
          validRows.push(dto);
        }
      } catch (error) {
        errors.push({
          row: rawRow.rowIndex || 0,
          message: `Lỗi transform data: ${error.message}`,
          data: rawRow,
        });
      }
    }

    return { validRows, errors };
  }

  /**
   * Generate Excel template for download
   */
  async generateExcelTemplate(): Promise<Buffer> {
    // Get sample data from DB
    const routes = await this.routeModel.find({ isActive: true }).limit(2).lean();
    const buses = await this.busModel.find({ status: 'AVAILABLE' }).limit(2).lean();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const template = [
      [
        'Tên tuyến đường',
        'Biển số xe',
        'Ngày khởi hành',
        'Giờ khởi hành',
        'Giờ đến',
        'Giá vé',
        'Tên tài xế',
        'SĐT tài xế',
        'GPLX',
        'Ghi chú',
      ],
    ];

    // Add sample rows from real DB data
    if (routes.length > 0 && buses.length > 0) {
      template.push([
        routes[0].name,
        buses[0].plateNo,
        tomorrowStr,
        routes[0].etd || '08:00',
        '', // ETA will be calculated
        routes[0].basePrice?.toString() || '150000',
        'Nguyễn Văn A',
        '0987654321',
        'B1234567',
        'Lịch trình mẫu',
      ]);

      if (routes[1] && buses[1]) {
        template.push([
          routes[1].name,
          buses[1].plateNo,
          tomorrowStr,
          routes[1].etd || '14:00',
          '',
          routes[1].basePrice?.toString() || '200000',
          'Trần Văn B',
          '0987654322',
          'B1234568',
          '',
        ]);
      }
    } else {
      // Fallback if no data in DB
      template.push([
        'Ví dụ: Hà Nội - Đà Nẵng',
        'Ví dụ: 51A-12345',
        tomorrowStr,
        '08:00',
        '14:00',
        '250000',
        'Nguyễn Văn A',
        '0987654321',
        'B1234567',
        'Tải dữ liệu từ hệ thống để có template chính xác',
      ]);
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(template);

    // Set column widths
    worksheet['!cols'] = [
      { width: 25 }, // Tên tuyến
      { width: 15 }, // Biển số
      { width: 15 }, // Ngày
      { width: 12 }, // Giờ đi
      { width: 12 }, // Giờ đến
      { width: 12 }, // Giá
      { width: 18 }, // Tên tài xế
      { width: 15 }, // SĐT
      { width: 12 }, // GPLX
      { width: 30 }, // Ghi chú
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lịch trình');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generate validation report
   */
  generateValidationReport(
    totalRows: number,
    validRows: SchedulingExcelRowDto[],
    errors: Array<{ row: number; field?: string; message: string; data?: any }>,
  ): ExcelImportResultDto {
    return {
      totalRows,
      successCount: validRows.length,
      errorCount: errors.length,
      createdSchedules: [],
      errors,
      warnings: [],
    };
  }
}
