/**
 * Exhaustiveness check helper for switch statements.
 * When all cases are handled, the value narrows to `never`.
 * If a new variant is added to the union, this causes a compile error.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
