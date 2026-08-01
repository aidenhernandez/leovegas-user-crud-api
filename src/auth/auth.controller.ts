import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { JsonApiEnvelopeInterceptor } from '../common/jsonapi/jsonapi-envelope.interceptor';
import { JsonApiResourceObject } from '../common/jsonapi/jsonapi.types';
import {
  UserSerializer,
  UserAttributes,
} from '../users/serializers/user.serializer';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
@UseInterceptors(JsonApiEnvelopeInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userSerializer: UserSerializer,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
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
}
