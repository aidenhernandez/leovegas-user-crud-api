/**
 * Base for business-rule errors raised by service-layer code. Deliberately
 * independent of Nest's HttpException — the domain layer shouldn't know it's
 * being driven over HTTP. JsonApiExceptionFilter is what translates
 * `status`/`title`/`message` into a JSON:API error object.
 */
export abstract class DomainException extends Error {
  abstract readonly status: number;
  abstract readonly title: string;

  constructor(detail: string) {
    super(detail);
    this.name = new.target.name;
  }
}
