export class ApiRequestError extends Error {
  status: number;
  code: string | null;
  details: unknown;
  url: string;

  constructor(
    message: string,
    options: { status: number; code?: string | null; details?: unknown; url: string },
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = typeof options.code === 'string' ? options.code : null;
    this.details = options.details;
    this.url = options.url;
  }
}

export function isApiRequestError(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError;
}
