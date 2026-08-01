import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../entities/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Alice' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    enum: Role,
    description:
      'Only honored when the requester is already an ADMIN; ignored otherwise.',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
