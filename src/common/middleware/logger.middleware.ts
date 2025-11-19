import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgRed: '\x1b[31m',
  fgCyan: '\x1b[36m',
  fgMagenta: '\x1b[35m',
  fgBlue: '\x1b[34m',
};

function colorStatus(status: number) {
  if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) return colors.fgRed; // server error
  if (status >= Number(HttpStatus.BAD_REQUEST)) return colors.fgYellow; // client error
  if (status >= Number(HttpStatus.AMBIGUOUS)) return colors.fgCyan; // redirect
  if (status >= Number(HttpStatus.OK)) return colors.fgGreen; // success
  return colors.fgMagenta;
}

function methodIcon(method: string) {
  switch (method) {
    case 'GET':
      return '🔍';
    case 'POST':
      return '📝';
    case 'PUT':
      return '✏️';
    case 'PATCH':
      return '🩹';
    case 'DELETE':
      return '🗑️';
    default:
      return '➡️';
  }
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;
    const icon = methodIcon(method);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      const statusColor = colorStatus(statusCode);

      console.log(
        `${colors.dim}[${new Date().toISOString()}]${colors.reset} ` +
          `${icon} ${colors.fgBlue}${method}${colors.reset} ` +
          `${colors.fgMagenta}${originalUrl}${colors.reset} ` +
          `${statusColor}${statusCode}${colors.reset} ` +
          `- ${colors.fgCyan}${duration}ms${colors.reset} ` +
          `- ${colors.dim}${ip}${colors.reset}`,
      );
    });

    next();
  }
}
