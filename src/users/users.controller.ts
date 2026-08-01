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
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from './entities/user.entity';
import { Role } from './entities/role.enum';
import { UsersService } from './users.service';
import { UserSerializer, UserAttributes } from './serializers/user.serializer';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JsonApiEnvelopeInterceptor } from '../common/jsonapi/jsonapi-envelope.interceptor';
import {
  JsonApiCollectionDocument,
  JsonApiResourceObject,
} from '../common/jsonapi/jsonapi.types';

@ApiTags('users')
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Register a new user, or (as an ADMIN) provision one with a chosen role',
    description:
      'Anonymous callers are always forced to USER. An authenticated ADMIN ' +
      'caller may set `role` explicitly.',
  })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() requester?: User,
  ): Promise<JsonApiResourceObject<UserAttributes>> {
    const user = await this.usersService.create(dto, requester);
    return this.userSerializer.serialize(user);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List users (ADMIN only), paginated' })
  @ApiResponse({ status: 200, description: 'A page of users' })
  @ApiResponse({ status: 403, description: 'Requester is not an ADMIN' })
  async findAll(
    @CurrentUser() requester: User,
    @Query() query: ListUsersQueryDto,
  ): Promise<JsonApiCollectionDocument<UserAttributes>> {
    const { items, totalCount } = await this.usersService.findAll(requester, {
      page: query.page,
      limit: query.limit,
    });
    return {
      data: items.map((user) => this.userSerializer.serialize(user)),
      meta: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit),
      },
    };
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a user by id (self or ADMIN)' })
  @ApiResponse({ status: 200, description: 'The user' })
  @ApiResponse({
    status: 403,
    description: 'Requester is neither the target user nor an ADMIN',
  })
  @ApiResponse({
    status: 404,
    description: 'No such user (ADMIN only - a non-admin gets 403 instead)',
  })
  async findOne(
    @CurrentUser() requester: User,
    @Param('id') id: string,
  ): Promise<JsonApiResourceObject<UserAttributes>> {
    const user = await this.usersService.findOne(requester, id);
    return this.userSerializer.serialize(user);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a user (self or ADMIN); changing role requires ADMIN',
  })
  @ApiResponse({ status: 200, description: 'The updated user' })
  @ApiResponse({ status: 403, description: 'Not permitted' })
  @ApiResponse({ status: 404, description: 'No such user' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async update(
    @CurrentUser() requester: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<JsonApiResourceObject<UserAttributes>> {
    const user = await this.usersService.update(requester, id, dto);
    return this.userSerializer.serialize(user);
  }

  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Same as PATCH :id - aliased to the same handler' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user (ADMIN only, cannot delete self)' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Not an ADMIN, or targeting self' })
  @ApiResponse({ status: 404, description: 'No such user' })
  async remove(
    @CurrentUser() requester: User,
    @Param('id') id: string,
  ): Promise<void> {
    await this.usersService.remove(requester, id);
  }
}
