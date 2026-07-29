import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class ForbiddenActionException extends DomainException {
  readonly status = HttpStatus.FORBIDDEN;
  readonly title = 'Forbidden';

  constructor(detail = 'You are not allowed to perform this action') {
    super(detail);
  }
}
