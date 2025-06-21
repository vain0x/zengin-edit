export type Result<T, E> = { type: "ok"; value: T } | { type: "error"; reason: E }

export const Result = {
  Ok<T>(value: T): Result<T, never> {
    return { type: "ok", value }
  },
  Error<E>(reason: E): Result<never, E> {
    return { type: "error", reason }
  },
} as const
