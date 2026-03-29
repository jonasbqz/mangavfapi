import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterExternalMediaDto {
  @ApiProperty({ enum: ['image', 'gif', 'sticker'] })
  @IsEnum(['image', 'gif', 'sticker'])
  mediaType: 'image' | 'gif' | 'sticker';

  @ApiProperty({ description: 'HTTPS URL del asset externo' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  originalUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}

export class CreateUploadSessionDto {
  @ApiProperty({ enum: ['image', 'gif', 'sticker'] })
  @IsEnum(['image', 'gif', 'sticker'])
  mediaType: 'image' | 'gif' | 'sticker';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  fileName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}
