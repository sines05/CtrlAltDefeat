import { randomUUID } from 'node:crypto';

export function createErrorResponse(code, message, retryable, traceId = randomUUID()) {
  return {
    error: {
      code,
      message,
      retryable,
      traceId,
    },
  };
}
