import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { JsonApiEnvelopeInterceptor } from '../jsonapi-envelope.interceptor';
import { JSON_API_CONTENT_TYPE } from '../jsonapi.types';

function buildContext(): { context: ExecutionContext; setHeader: jest.Mock } {
  const setHeader = jest.fn();
  const context = {
    switchToHttp: () => ({ getResponse: () => ({ setHeader }) }),
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

function buildHandler(payload: unknown): CallHandler {
  return { handle: () => of(payload) };
}

describe('JsonApiEnvelopeInterceptor', () => {
  const interceptor = new JsonApiEnvelopeInterceptor();

  it('sets the JSON:API content type on the response', async () => {
    const { context, setHeader } = buildContext();

    await firstValueFrom(
      interceptor.intercept(context, buildHandler({ id: '1' })),
    );

    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      JSON_API_CONTENT_TYPE,
    );
  });

  it('wraps a bare resource payload in a top-level data member', async () => {
    const { context } = buildContext();
    const resource = { type: 'users', id: '1', attributes: {} };

    const result = await firstValueFrom(
      interceptor.intercept(context, buildHandler(resource)),
    );

    expect(result).toEqual({ data: resource });
  });

  it('passes an undefined payload through unchanged (e.g. a 204 response)', async () => {
    const { context } = buildContext();

    const result = await firstValueFrom(
      interceptor.intercept(context, buildHandler(undefined)),
    );

    expect(result).toBeUndefined();
  });

  it('passes a pre-built envelope through unchanged instead of double-wrapping it', async () => {
    const { context } = buildContext();
    const envelope = {
      data: [{ type: 'users', id: '1', attributes: {} }],
      meta: { page: 1, limit: 20, totalCount: 1, totalPages: 1 },
    };

    const result = await firstValueFrom(
      interceptor.intercept(context, buildHandler(envelope)),
    );

    expect(result).toBe(envelope);
  });

  it('still wraps an array payload rather than mistaking it for a pre-built envelope', async () => {
    const { context } = buildContext();
    const resources = [{ type: 'users', id: '1', attributes: {} }];

    const result = await firstValueFrom(
      interceptor.intercept(context, buildHandler(resources)),
    );

    expect(result).toEqual({ data: resources });
  });
});
