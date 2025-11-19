import { diskStorage } from 'multer';
import * as path from 'path';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';

export const excelFileOptions = {
  storage: diskStorage({
    destination: './uploads/buses', // folder lưu tạm
    filename: (
      req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}${ext}`); // tên file duy nhất
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Only Excel files are allowed'));
    }
    cb(null, true);
  },
};
