/**
 * Esquemas de validación con Zod v4 para la capa de datos.
 * Se ejecutan antes de cualquier escritura en SQLite para garantizar
 * integridad de los campos requeridos.
 */

import { z } from 'zod';
import type { AudioAssetType, IntermediateMode } from '@/data/models';

export const uuidSchema = z.uuid();

export const nonEmptyString = z.string().min(1, { message: 'El campo no puede estar vacío' });

const audioAssetTypeEnum = {
  MAIN_TRACK: 'MAIN_TRACK',
  INTERMEDIATE_LOOP: 'INTERMEDIATE_LOOP',
} as const;

const intermediateModeEnum = {
  GLOBAL_DEFAULT: 'GLOBAL_DEFAULT',
  CUSTOM: 'CUSTOM',
  SILENCE: 'SILENCE',
} as const;

export const audioAssetTypeSchema = z.nativeEnum(audioAssetTypeEnum) as z.ZodType<AudioAssetType>;

export const intermediateModeSchema = z.nativeEnum(
  intermediateModeEnum
) as z.ZodType<IntermediateMode>;

export const isoDatetimeSchema = z.iso.datetime();

export const positiveIntSchema = z.number().int().nonnegative();

export const nullableString = z.string().nullable();
export const nullablePositiveInt = positiveIntSchema.nullable();

export const createAudioAssetInputSchema = z
  .object({
    type: audioAssetTypeSchema,
    display_name: nonEmptyString,
    original_filename: nonEmptyString,
    internal_uri: nonEmptyString,
    external_source_uri: nullableString.optional(),
    source_url: z.string().url().nullable().optional(),
    file_extension: z.string().min(1),
    mime_type: nullableString.optional(),
    duration_ms: nullablePositiveInt.optional(),
    file_size_bytes: nullablePositiveInt.optional(),
    sample_rate: nullablePositiveInt.optional(),
    channels: nullablePositiveInt.optional(),
    loudness_hint_db: z.number().nullable().optional(),
    artist: nullableString.optional(),
    album: nullableString.optional(),
  })
  .strict();

export const updateAudioAssetInputSchema = createAudioAssetInputSchema
  .partial()
  .and(z.object({ id: uuidSchema }));

export const createSetlistInputSchema = z
  .object({
    name: nonEmptyString,
    description: nullableString.optional(),
    default_intermediate_audio_id: uuidSchema.nullable().optional(),
  })
  .strict();

export const updateSetlistInputSchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyString.optional(),
    description: nullableString.optional(),
    default_intermediate_audio_id: uuidSchema.nullable().optional(),
    last_played_at: isoDatetimeSchema.nullable().optional(),
  })
  .strict();

export const createSetlistItemInputSchema = z
  .object({
    setlist_id: uuidSchema,
    position: positiveIntSchema.optional(),
    song_title: nonEmptyString,
    artist: nullableString.optional(),
    main_audio_id: uuidSchema,
    intermediate_audio_id: uuidSchema.nullable().optional(),
    intermediate_mode: intermediateModeSchema.optional(),
    notes: nullableString.optional(),
    fade_out_loop_ms: nullablePositiveInt.optional(),
    fade_in_loop_ms: nullablePositiveInt.optional(),
  })
  .strict();

export const updateSetlistItemInputSchema = z
  .object({
    id: uuidSchema,
    song_title: nonEmptyString.optional(),
    artist: nullableString.optional(),
    main_audio_id: uuidSchema.optional(),
    intermediate_audio_id: uuidSchema.nullable().optional(),
    intermediate_mode: intermediateModeSchema.optional(),
    notes: nullableString.optional(),
    fade_out_loop_ms: nullablePositiveInt.optional(),
    fade_in_loop_ms: nullablePositiveInt.optional(),
    position: positiveIntSchema.optional(),
  })
  .strict();

export type CreateAudioAssetInputDto = z.infer<typeof createAudioAssetInputSchema>;
export type CreateSetlistInputDto = z.infer<typeof createSetlistInputSchema>;
export type CreateSetlistItemInputDto = z.infer<typeof createSetlistItemInputSchema>;
