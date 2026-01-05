import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string;
    let errors: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        errors = (exceptionResponse as any).errors;
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      // Handle MongoDB/Mongoose errors
      if (exception.name === 'ValidationError') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Dữ liệu không hợp lệ';
        errors = this.formatValidationErrors(exception);
      } else if (exception.name === 'CastError') {
        status = HttpStatus.BAD_REQUEST;
        message = 'ID không hợp lệ';
      } else if (exception.message.includes('duplicate key')) {
        status = HttpStatus.CONFLICT;
        message = 'Dữ liệu đã tồn tại';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Lỗi hệ thống không xác định';
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Lỗi hệ thống không xác định';
    }

    // Log error for debugging
    this.logger.error({
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      message: exception instanceof Error ? exception.message : 'Unknown error',
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(errors && { errors }),
    };

    response.status(status).json(errorResponse);
  }

  private formatValidationErrors(error: any): string[] {
    if (error.errors) {
      return Object.values(error.errors).map((err: any) => err.message);
    }
    return [error.message];
  }
}
