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
} from '@nestjs/common';
import { User } from './entities/user.entity';
import { Role } from './entities/role.enum';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @OptionalAuth()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() requester?: User,
  ): Promise<User> {
    return this.usersService.create(dto, requester);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(@CurrentUser() requester: User): Promise<User[]> {
    return this.usersService.findAll(requester);
  }

  @Get(':id')
  findOne(
    @CurrentUser() requester: User,
    @Param('id') id: string,
  ): Promise<User> {
    return this.usersService.findOne(requester, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() requester: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(requester, id, dto);
  }

  @Put(':id')
  replace(
    @CurrentUser() requester: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(requester, id, dto);
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
