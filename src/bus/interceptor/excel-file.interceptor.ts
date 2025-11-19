import { FileInterceptor } from '@nestjs/platform-express';
import { excelFileOptions } from './excel-file-options';

export const ExcelFileInterceptor = () =>
  FileInterceptor('file', excelFileOptions);
