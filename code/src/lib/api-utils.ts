import { ZodSchema } from 'zod';

// ========== 统一错误响应格式 ==========

interface ApiErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  TIMEOUT: 408,
  PROVIDER_ERROR: 502,
  INTERNAL: 500,
} as const;

type ErrorCode = keyof typeof ERROR_CODES;

/** 构造统一格式的错误响应 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status?: number,
  details?: unknown,
): Response {
  const httpStatus = status ?? ERROR_CODES[code];
  const body: ApiErrorResponse = { error: message, code };
  if (details !== undefined) body.details = details;
  return Response.json(body, { status: httpStatus });
}

// ========== 高阶包装器 ==========

interface ApiHandlerOptions<T> {
  /** 请求体 Zod 校验 schema */
  schema?: ZodSchema<T>;
  /** 超时毫秒数（非流式路由默认 30000，流式路由不设整体超时） */
  timeout?: number;
}

/**
 * 包裹需要请求体的 API 路由（POST/PATCH）。
 * 自动处理：请求解析、Zod 校验、超时、外层 try-catch。
 */
export function withApiHandler<T>(
  handler: (req: Request, body: T) => Promise<Response>,
  options?: ApiHandlerOptions<T>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      // 解析请求体
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return errorResponse('VALIDATION_ERROR', 'Invalid JSON body');
      }

      // Zod 校验
      if (options?.schema) {
        const result = options.schema.safeParse(body);
        if (!result.success) {
          return errorResponse('VALIDATION_ERROR', 'Validation failed', 400, result.error.flatten());
        }
        body = result.data;
      }

      // 非流式路由：对整体 handler 设置超时
      if (options?.timeout) {
        return await Promise.race([
          handler(req, body as T),
          createTimeoutPromise(options.timeout),
        ]);
      }

      return await handler(req, body as T);
    } catch (error: unknown) {
      console.error('[API Handler] Unhandled error:', error);
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      return errorResponse('INTERNAL', message);
    }
  };
}

/**
 * 包裹 GET 路由（无需请求体）。
 * 自动处理：超时、外层 try-catch。
 */
export function withGetHandler(
  handler: (req: Request) => Promise<Response>,
  options?: { timeout?: number },
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      if (options?.timeout) {
        return await Promise.race([
          handler(req),
          createTimeoutPromise(options.timeout),
        ]);
      }
      return await handler(req);
    } catch (error: unknown) {
      console.error('[API Handler] Unhandled error:', error);
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      return errorResponse('INTERNAL', message);
    }
  };
}

function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(`Request timed out after ${ms}ms`));
    }, ms);
  });
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ========== Prisma 错误工具 ==========

/** 判断 Prisma 错误是否为"记录不存在"（P2025） */
export function isPrismaNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025';
}
