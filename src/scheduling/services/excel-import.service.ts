import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Scheduling, SchedulingDocument } from '../entities/scheduling.entity';
import { Route, RouteDocument } from '../../route/entities/route.entity';
import { Bus, BusDocument } from '../../bus/entities/bus.entity';
import { ExcelProcessingService } from './excel-processing.service';
import {
  SchedulingExcelRowDto,
  ExcelImportResultDto,
  ImportSchedulingExcelDto,
} from '../dto/excel-import.dto';

@Injectable()
export class ExcelImportService {
  constructor(
    @InjectModel(Scheduling.name)
    private schedulingModel: Model<SchedulingDocument>,
    @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
    @InjectModel(Bus.name) private busModel: Model<BusDocument>,
    private excelProcessingService: ExcelProcessingService,
  ) { }

  /**
   * Import scheduling data from Excel file
   */
  async importFromExcel(
    file: Express.Multer.File,
  ): Promise<ExcelImportResultDto> {
    try {
      console.log('🔄 Starting Excel import process...');

      // Parse Excel file
      const rawData = await this.excelProcessingService.parseExcelFile(
        file.buffer,
      );

      if (rawData.length === 0) {
        console.log('⚠️ No data found in Excel file');
        return {
          totalRows: 0,
          successCount: 0,
          errorCount: 1,
          createdSchedules: [],
          errors: [{
            row: 0,
            field: 'file',
            message: 'File Excel không chứa dữ liệu hợp lệ'
          }],
          warnings: [],
        };
      }

      console.log(`📊 Found ${rawData.length} rows in Excel file`);

      // Validate Excel data
      const { validRows, errors } =
        await this.excelProcessingService.validateExcelData(rawData);

      console.log(`✅ Valid rows: ${validRows.length}, ❌ Invalid rows: ${errors.length}`);

      // Process valid rows
      const result = await this.processValidRows(validRows);

      // Merge validation errors and processing errors
      const allErrors = [
        ...errors,
        ...(result.errors || []),
      ];

      console.log(`📈 Final result - Success: ${result.successCount}, Errors: ${allErrors.length}`);

      // Generate final report
      return {
        totalRows: rawData.length,
        successCount: result.successCount || 0,
        errorCount: allErrors.length,
        createdSchedules: result.createdSchedules || [],
        errors: allErrors,
        warnings: result.warnings || [],
      };
    } catch (error) {
      console.error('💥 Exception in importFromExcel:', error.message);

      // Return error response instead of throwing
      return {
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        createdSchedules: [],
        errors: [{
          row: 0,
          field: 'system',
          message: error instanceof BadRequestException
            ? error.message
            : `Lỗi hệ thống khi import Excel: ${error.message}`
        }],
        warnings: [],
      };
    }
  }

  /**
   * Process valid Excel rows to create scheduling entries
   */
  private async processValidRows(
    validRows: SchedulingExcelRowDto[],
  ): Promise<Partial<ExcelImportResultDto>> {
    const createdSchedules: any[] = [];
    const errors: any[] = [];
    const warnings: any[] = [];

    console.log('🔍 Processing valid rows:', validRows.length);

    // Get lookup data
    const routeLookup = await this.createRouteLookup();
    const busLookup = await this.createBusLookup();

    console.log('📍 Available routes:', Array.from(routeLookup.keys()));
    console.log('🚌 Available buses:', Array.from(busLookup.keys()));

    for (const row of validRows) {
      try {
        console.log(`\n🔎 Processing row ${row.rowIndex}:`, {
          routeName: row.routeName,
          plateNo: row.plateNo,
        });

        // Find route by name
        const route = routeLookup.get(row.routeName.trim().toLowerCase());
        if (!route) {
          console.log(`❌ Route not found: "${row.routeName}"`);
          errors.push({
            row: row.rowIndex || 0,
            field: 'routeName',
            message: `Không tìm thấy tuyến đường: ${row.routeName}`,
            data: row,
          });
          continue;
        }
        console.log(`✅ Route found:`, route.name);

        // Find bus by plate number
        const bus = busLookup.get(row.plateNo.trim().toLowerCase());
        if (!bus) {
          console.log(`❌ Bus not found: "${row.plateNo}"`);
          errors.push({
            row: row.rowIndex || 0,
            field: 'plateNo',
            message: `Không tìm thấy xe với biển số: ${row.plateNo}`,
            data: row,
          });
          continue;
        }

        // Check for duplicate scheduling
        const existingScheduling = await this.schedulingModel.findOne({
          routeId: route._id,
          busId: bus._id,
          departureDate: row.departureDate,
          etd: row.etd,
        });

        if (existingScheduling) {
          warnings.push({
            row: row.rowIndex || 0,
            message: `Lịch trình đã tồn tại: ${row.routeName} - ${row.plateNo} vào ${new Date(row.departureDate).toLocaleDateString()} lúc ${row.etd}`,
            data: row,
          });
          continue;
        }

        // Create scheduling data
        const schedulingData: any = {
          routeId: route._id,
          busId: bus._id,
          busIds: [bus._id],
          etd: row.etd,
          departureDate: row.departureDate,
          eta: row.eta,
          price: row.price || route.basePrice || route.pricePerKm || 0,
          note: row.note,
          availableSeats:
            bus.seats?.length || bus.vacancy || bus.seatCount || 30,
          bookedSeats: 0,
          status: 'scheduled',
          isActive: true,
        };

        // Add driver information if provided
        if (row.driverName) {
          schedulingData.driver = {
            name: row.driverName,
            phone: row.driverPhone || '',
            licenseNumber: row.driverLicense || '',
          };

          // Validate driver phone if provided
          if (row.driverPhone && !this.isValidPhoneNumber(row.driverPhone)) {
            warnings.push({
              row: row.rowIndex || 0,
              field: 'driverPhone',
              message: `Số điện thoại tài xế không hợp lệ: ${row.driverPhone}`,
              data: row,
            });
          }
        }

        // Calculate arrival date based on route duration
        if (row.eta && route.estimatedDuration) {
          schedulingData.arrivalDate = this.calculateArrivalDate(
            new Date(row.departureDate),
            route.estimatedDuration,
          );
        }

        // Create scheduling
        const newScheduling = new this.schedulingModel(schedulingData);
        const savedScheduling = await newScheduling.save();

        createdSchedules.push({
          _id: savedScheduling._id,
          routeId: route._id,
          busId: bus._id,
          routeName: route.name,
          plateNo: bus.plateNo,
          departureDate: savedScheduling.departureDate,
          etd: savedScheduling.etd,
          eta: savedScheduling.eta,
          price: savedScheduling.price,
          status: savedScheduling.status,
        });
      } catch (error) {
        errors.push({
          row: row.rowIndex || 0,
          message: `Lỗi tạo lịch trình: ${error.message}`,
          data: row,
        });
      }
    }

    return {
      successCount: createdSchedules.length,
      createdSchedules,
      errors,
      warnings,
    };
  }

  /**
   * Create route lookup map for faster searching
   */
  private async createRouteLookup(): Promise<Map<string, any>> {
    const routes = await this.routeModel.find({ isActive: true }).lean();
    const lookup = new Map();

    routes.forEach((route) => {
      const nameKey = (route as any).name?.trim().toLowerCase();
      const legacyKey = (route as any).routeName?.trim().toLowerCase();

      if (nameKey) {
        lookup.set(nameKey, route);
      }
      if (legacyKey) {
        lookup.set(legacyKey, route);
      }
    });

    return lookup;
  }

  /**
   * Create bus lookup map for faster searching
   */
  private async createBusLookup(): Promise<Map<string, any>> {
    const buses = await this.busModel.find({}).lean();
    const lookup = new Map();

    buses.forEach((bus) => {
      const key = (bus as any).plateNo?.trim().toLowerCase();
      if (key) {
        lookup.set(key, bus);
      }
    });

    return lookup;
  }

  /**
   * Validate Vietnamese phone number format (0xxxxxxxxx only)
   */
  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^0[3|5|7|8|9][0-9]{8}$/;
    return phoneRegex.test(phone.trim());
  }

  /**
   * Calculate arrival date based on departure date and estimated duration
   */
  private calculateArrivalDate(
    departureDate: Date,
    estimatedDurationMinutes: number,
  ): Date {
    const arrivalDate = new Date(departureDate);
    arrivalDate.setMinutes(arrivalDate.getMinutes() + estimatedDurationMinutes);
    return arrivalDate;
  }

  /**
   * Generate Excel template for download
   */
  async generateTemplate(): Promise<Buffer> {
    return this.excelProcessingService.generateExcelTemplate();
  }

  /**
   * Validate import data before processing
   */
  async validateImportData(file: Express.Multer.File): Promise<{
    valid: number;
    invalid: number;
    errors: Array<{ row: number; field: string; message: string }>;
  }> {
    try {
      const rawData = await this.excelProcessingService.parseExcelFile(
        file.buffer,
      );
      const { validRows, errors } =
        await this.excelProcessingService.validateExcelData(rawData);

      return {
        valid: validRows.length,
        invalid: errors.length,
        errors: errors.map((error) => ({
          row: error.row,
          field: error.field || 'unknown',
          message: error.message,
        })),
      };
    } catch (error) {
      return {
        valid: 0,
        invalid: 0,
        errors: [{ row: 0, field: 'file', message: error.message }],
      };
    }
  }
}
