import * as XLSX from 'xlsx';
import { Injectable, BadRequestException } from '@nestjs/common';

export interface ExcelRowOptions<T> {
  requiredFields?: (keyof T)[];
  defaultValues?: Partial<T>;
  transform?: (row: Partial<T>) => Partial<T>;
}

@Injectable()
export class ExcelService {
  async importExcel<T>(
    filePath: string,
    createFn: (dto: T) => Promise<T>,
    options?: ExcelRowOptions<T>,
  ): Promise<T[]> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[] = XLSX.utils.sheet_to_json(sheet);

    const result: T[] = [];

    for (const [index, row] of rows.entries()) {
      // ensure row is an object
      if (typeof row !== 'object' || row === null) {
        throw new BadRequestException(`Row ${index + 2} is not a valid object`);
      }

      const rowObj = row as Record<string, unknown>;

      // Check required fields
      if (options?.requiredFields) {
        for (const field of options.requiredFields) {
          const key = String(field); // convert keyof T -> string
          if (
            !(key in rowObj) ||
            rowObj[key] === undefined ||
            rowObj[key] === null
          ) {
            throw new BadRequestException(
              `Row ${index + 2} missing required field "${key}"`,
            );
          }
        }
      }

      const dto: T = {
        ...(options?.defaultValues || {}),
        ...rowObj,
        ...(options?.transform ? options.transform(rowObj as Partial<T>) : {}),
      } as T;

      // Call create function
      result.push(await createFn(dto));
    }

    return result;
  }
}
