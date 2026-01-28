import { IsInt, IsOptional, IsString, IsBoolean, IsArray, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlaylistDto {
  @ApiProperty({ example: 'Mis favoritos de acción', description: 'Nombre de la playlist' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Los mejores mangas de acción que he leído', description: 'Descripción de la playlist' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: false, description: 'Si la playlist es pública' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'URL de la imagen de portada' })
  @IsOptional()
  @IsString()
  coverImage?: string;
}

export class UpdatePlaylistDto {
  @ApiPropertyOptional({ example: 'Nuevo nombre', description: 'Nombre de la playlist' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Descripción de la playlist' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Si la playlist es pública' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'URL de la imagen de portada' })
  @IsOptional()
  @IsString()
  coverImage?: string;
}

export class ReorderPlaylistDto {
  @ApiProperty({
    example: [{ comicId: 1, order: 0 }, { comicId: 2, order: 1 }],
    description: 'Array con el nuevo orden de los comics'
  })
  @IsArray()
  items: { comicId: number; order: number }[];
}
