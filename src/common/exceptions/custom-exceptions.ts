import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessLogicException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        statusCode,
        error: 'Business Logic Error',
        message,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(errors: string[]) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'Validation Failed',
        message: 'Dữ liệu đầu vào không hợp lệ',
        errors,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} với ID '${id}' không tồn tại`
      : `${resource} không tồn tại`;

    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Resource Not Found',
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DuplicateResourceException extends HttpException {
  constructor(resource: string, field: string, value: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'Duplicate Resource',
        message: `${resource} với ${field} '${value}' đã tồn tại`,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidOperationException extends HttpException {
  constructor(operation: string, reason: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Invalid Operation',
        message: `Không thể thực hiện ${operation}: ${reason}`,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
