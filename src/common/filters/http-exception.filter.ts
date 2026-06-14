import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { isDatabaseConnectionError } from '@/lib/db-pool';

function formatErrorChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }

  return parts.length > 0 ? parts.join(' | cause: ') : String(error);
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || message;
        error = resObj.error || exception.name;
      }
    } else if (exception instanceof Error) {
      if (isDatabaseConnectionError(exception)) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'La base de datos está saturada. Reintenta en unos segundos.';
        error = 'Service Unavailable';
        this.logger.warn(`Database connection saturation: ${formatErrorChain(exception)}`);
      } else {
        message = exception.message;
        this.logger.error(
          `Unhandled error: ${formatErrorChain(exception)}`,
          exception.stack,
        );
      }
    }

    response.status(status).send({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
