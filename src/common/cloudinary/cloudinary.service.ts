import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from 'cloudinary';

export interface BusImageDto {
  url: string;
  publicId: string;
}

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<BusImageDto> {
    if (!file) throw new BadRequestException('File không hợp lệ');

    return new Promise<BusImageDto>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          transformation: [{ width: 1200, crop: 'limit' }],
        } as UploadApiOptions,
        (error: any, result: UploadApiResponse) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary upload failed'));
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  // Upload nhiều file
  async uploadFiles(files: Express.Multer.File[], folder: string): Promise<BusImageDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file để upload');
    }

    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(publicId: string): Promise<void> {
    if (!publicId) throw new BadRequestException('publicId không hợp lệ');

    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { resource_type: 'image' },
        (err, result) => {
          if (err) return reject(err);
          resolve();
        });
    });
  }
}
