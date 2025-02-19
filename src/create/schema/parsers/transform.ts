import type { ZodEffects, ZodType, ZodTypeAny, input, output } from 'zod';

import type { oas31 } from '../../../openapi3-ts/dist';
import { type SchemaState, createSchemaObject } from '../../schema';

import { createManualTypeSchema } from './manual';

export const createTransformSchema = <
  T extends ZodTypeAny,
  Output = output<T>,
  Input = input<T>,
>(
  zodTransform: ZodEffects<T, Output, Input>,
  state: SchemaState,
): oas31.SchemaObject | oas31.ReferenceObject => {
  if (zodTransform._def.openapi?.effectType === 'output') {
    return createManualTypeSchema(zodTransform, state);
  }

  if (zodTransform._def.openapi?.effectType === 'input') {
    return createSchemaObject(zodTransform._def.schema, state, [
      'transform input',
    ]);
  }

  if (state.type === 'output') {
    return createManualTypeSchema(zodTransform, state);
  }

  state.effectType = 'input';
  return createSchemaObject(zodTransform._def.schema, state, [
    'transform input',
  ]);
};

export const throwTransformError = (zodType: ZodType, state: SchemaState) => {
  throw new Error(
    `${JSON.stringify(zodType)} at ${state.path.join(
      ' > ',
    )} contains a transformation but is used in both an input and an output. This is likely a mistake. Set an \`effectType\`, wrap it in a ZodPipeline or assign it a manual type to resolve`,
  );
};
