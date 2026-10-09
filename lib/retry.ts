// connection problems / timeouts / pool full
const RETRYABLE_PRISMA_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
]);

const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export function isRetryableError(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const { code, status } = error as { code?: unknown; status?: unknown };

    if (typeof code === "string") {
      if (RETRYABLE_PRISMA_CODES.has(code)) return true;
      if (RETRYABLE_NETWORK_CODES.has(code)) return true;
    }

    if (typeof status === "number" && RETRYABLE_STATUSES.has(status)) {
      return true;
    }
  }

  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset")
  );
}

// exponential backoff. only use for things that are safe to repeat!
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      const delay = 500 * 2 ** (attempt - 1);
      console.warn(
        `Attempt ${attempt} failed, retrying in ${delay}ms:`,
        error instanceof Error ? error.message : error,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // never gets here but TS doesn't know that
  throw lastError;
}
