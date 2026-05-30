/**
 * Narrow assertion helper. Throws a clear error if the condition fails.
 * Use only for invariant violations, never for user-input validation.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant failed: ${message}`);
  }
}

export function assertNever(value: never, context = 'unhandled case'): never {
  throw new Error(`${context}: ${JSON.stringify(value)}`);
}
