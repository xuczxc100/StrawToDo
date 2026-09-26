export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toErrorBody(err: unknown): {
  status: number;
  body: { code: string; message: string; details?: unknown };
} {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { code: err.code, message: err.message, details: err.details },
    };
  }
  console.error(err);
  return {
    status: 500,
    body: { code: "internal_error", message: "Internal server error" },
  };
}
