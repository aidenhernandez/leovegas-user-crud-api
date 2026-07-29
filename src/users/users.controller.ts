import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { User } from './entities/user.entity';
import { Role } from './entities/role.enum';
import { UsersService } from './users.service';
import { UserSerializer, UserAttributes } from './serializers/user.serializer';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JsonApiEnvelopeInterceptor } from '../common/jsonapi/jsonapi-envelope.interceptor';
import { JsonApiResourceObject } from '../common/jsonapi/jsonapi.types';

@Controller('users')
@UseGuards(RolesGuard)
@UseInterceptors(JsonApiEnvelopeInterceptor)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userSerializer: UserSerializer,
  ) {}

  @Post()
  @OptionalAuth()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() requester?: User,
  ): Promise<JsonApiResourceObject<UserAttributes>> {
    const user = await this.usersService.create(dto, requester);
    return this.userSerializer.serialize(user);
  }

  @Get()
  @Roles(Role.ADMIN)
  async findAll(
    @CurrentUser() requester: User,
  ): Promise<JsonApiResourceObject<UserAttributes>[]> {
    const users = await this.usersService.findAll(requester);
    return users.map((user) => this.userSerializer.serialize(user));
  }

  @Get(':id')
  async findOne(
    @CurrentUser() requester: User,
    @Param('id') id: string,
  ): Promise<JsonApiResourceObject<UserAttributes>> {
    const user = await this.usersService.findOne(requester, id);
    return this.userSerializer.serialize(user);
  }

  @Patch(':id')
  async update(
    @CurrentUser() requester: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<JsonApiResourceObject<UserAttributes>> {
    const user = await this.usersService.update(requester, id, dto);
    return this.userSerializer.serialize(user);
  }

  @Put(':id')
  async replace(
    @CurrentUser() requester: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<JsonApiResourceObject<UserAttributes>> {
    const user = await this.usersService.update(requester, id, dto);
    return this.userSerializer.serialize(user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() requester: User,
    @Param('id') id: string,
  ): Promise<void> {
    await this.usersService.remove(requester, id);
  }
}
