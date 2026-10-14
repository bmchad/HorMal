import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(status: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export function parseBody<T>(raw: string | undefined, isBase64?: boolean): T {
  if (!raw) throw new HttpError(400, 'Missing request body');
  try {
    const text = isBase64 ? Buffer.from(raw, 'base64').toString('utf8') : raw;
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
