/**
 * Transport-agnostic API error carrying an HTTP status. Lives in its own
 * dependency-free module so libraries (e.g. rate-limit) can throw it without
 * pulling in auth/Clerk. `withApi` maps it to a JSON response.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
