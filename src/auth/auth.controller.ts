import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JsonApiEnvelopeInterceptor } from '../common/jsonapi/jsonapi-envelope.interceptor';
import { JsonApiResourceObject } from '../common/jsonapi/jsonapi.types';
import { User } from '../users/entities/user.entity';
import {
  UserSerializer,
  UserAttributes,
} from '../users/serializers/user.serializer';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
@UseInterceptors(JsonApiEnvelopeInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userSerializer: UserSerializer,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange email/password for an access token' })
  @ApiResponse({
    status: 200,
    description: 'User resource with the access token in meta.accessToken',
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
  ): Promise<JsonApiResourceObject<UserAttributes>> {
    const { user, accessToken } = await this.authService.login(
      dto.email,
      dto.password,
    );
    return {
      ...this.userSerializer.serialize(user),
      meta: { accessToken },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Invalidate the caller's current access token" })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or expired token',
  })
  async logout(@CurrentUser() requester: User): Promise<void> {
    await this.authService.logout(requester.id);
  }
}
