// Prisma errors that mean the database was briefly unavailable, not that
// the query was wrong: can't reach the server (P1001), connection or
// operation timed out (P1002, P1008), connection closed (P1017), and no free
// connection in the pool (P2024)
const RETRYABLE_PRISMA_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
]);

// Node network errors that a second attempt can get past
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

// HTTP statuses from APIs: rate limited, or the service is temporarily down
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

// Whether an error is temporary (worth retrying) or permanent (a retry would
// fail the same way). Checks structured fields first, since message text
// varies between libraries; the message check is only a fallback.
// Business failures (employee not found, insufficient balance) never get
// here: the tools return them as results rather than throwing.
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

// Runs fn, and if it throws a temporary error, waits and tries again, up to
// maxRetries attempts in total. The wait doubles each time (500ms, 1000ms, …)
// so a briefly overloaded database or API gets a moment to recover. A
// permanent error is thrown straight away: retrying it would only add delay.
// Only use it for operations that are safe to repeat: reads, or writes
// protected by an idempotency key.
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

  // Unreachable (the last attempt returns or throws), but TypeScript can't
  // tell the loop always runs
  throw lastError;
}
