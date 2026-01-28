import { IsInt, IsOptional, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 1, description: 'ID del comic' })
  @IsInt()
  comicId: number;

  @ApiPropertyOptional({ example: 1, description: 'ID del capítulo (opcional)' })
  @IsOptional()
  @IsInt()
  chapterId?: number;

  @ApiPropertyOptional({ description: 'ID del comentario padre para respuestas' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ example: 'Este manga es increíble!', description: 'Contenido del comentario' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Contenido actualizado', description: 'Nuevo contenido del comentario' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
