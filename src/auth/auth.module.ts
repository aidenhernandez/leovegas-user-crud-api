import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HashingModule } from './hashing/hashing.module';
import { TOKEN_GENERATOR } from './tokens/token-generator.interface';
import { CryptoTokenGenerator } from './tokens/crypto-token-generator';

@Module({
  imports: [UsersModule, HashingModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: TOKEN_GENERATOR, useClass: CryptoTokenGenerator },
  ],
  exports: [AuthService],
})
export class AuthModule {}
