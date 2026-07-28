import { Module } from '@nestjs/common';
import { PASSWORD_HASHER } from './password-hasher.interface';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';

@Module({
  providers: [{ provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher }],
  exports: [PASSWORD_HASHER],
})
export class HashingModule {}
