import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  success: false;
  timestamp: string;
  path: string;
  method: string;
  message: string | object;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    let message: string | object;
    if (typeof rawMessage === 'string') {
      message = rawMessage;
    } else if (typeof rawMessage === 'object' && rawMessage !== null) {
      message =
        'message' in rawMessage
          ? (rawMessage as { message: string }).message
          : rawMessage;
    } else {
      message = String(rawMessage);
    }

    // Format timestamp DD-MM-YYYY HH:mm:ss
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const errorResponse: ErrorResponse = {
      statusCode: status,
      success: false,
      timestamp: `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`,
      path: request.url,
      method: request.method,
      message,
    };

    // Log error
    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      console.error('Server Error:', exception);
    } else if (status >= Number(HttpStatus.BAD_REQUEST)) {
      console.warn('Client Error:', errorResponse);
    }

    response.status(status).json(errorResponse);
  }
}
