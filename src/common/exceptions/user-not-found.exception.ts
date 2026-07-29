import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class UserNotFoundException extends DomainException {
  readonly status = HttpStatus.NOT_FOUND;
  readonly title = 'Not Found';

  constructor(userId: string) {
    super(`User ${userId} not found`);
  }
}
