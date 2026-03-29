import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
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
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({ type: [String], description: 'IDs de assets adjuntos del usuario' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Contenido actualizado', description: 'Nuevo contenido del comentario' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class VoteCommentDto {
  @ApiProperty({ enum: ['up', 'down'], description: 'Dirección del voto' })
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}

export class GetCommentsQueryDto {
  @ApiPropertyOptional({ enum: ['best', 'newest', 'oldest'] })
  @IsOptional()
  @IsIn(['best', 'newest', 'oldest'])
  sort?: 'best' | 'newest' | 'oldest';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
