import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class DuplicateEmailException extends DomainException {
  readonly status = HttpStatus.CONFLICT;
  readonly title = 'Conflict';

  constructor(email: string) {
    super(`Email ${email} is already in use`);
  }
}
