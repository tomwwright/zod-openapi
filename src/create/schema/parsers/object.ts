import type {
  UnknownKeysParam,
  ZodObject,
  ZodRawShape,
  ZodType,
  ZodTypeAny,
  objectInputType,
  objectOutputType,
} from 'zod';

import type { oas31 } from '../../../openapi3-ts/dist';
import { isZodType } from '../../../zodType';
import { createComponentSchemaRef } from '../../components';
import { type SchemaState, createSchemaObject } from '../../schema';

import { isOptionalSchema } from './optional';

export const createObjectSchema = <
  T extends ZodRawShape,
  UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
  Catchall extends ZodTypeAny = ZodTypeAny,
  Output = objectOutputType<T, Catchall, UnknownKeys>,
  Input = objectInputType<T, Catchall, UnknownKeys>,
>(
  zodObject: ZodObject<T, UnknownKeys, Catchall, Output, Input>,
  state: SchemaState,
): oas31.SchemaObject => {
  const extendedSchema = createExtendedSchema(
    zodObject,
    zodObject._def.extendMetadata?.extends,
    state,
  );

  if (extendedSchema) {
    return extendedSchema;
  }

  return createObjectSchemaFromShape(
    zodObject.shape,
    {
      unknownKeys: zodObject._def.unknownKeys,
      catchAll: zodObject._def.catchall as ZodType,
    },
    state,
  );
};

export const createExtendedSchema = <
  T extends ZodRawShape,
  UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
  Catchall extends ZodTypeAny = ZodTypeAny,
  Output = objectOutputType<T, Catchall, UnknownKeys>,
  Input = objectInputType<T, Catchall, UnknownKeys>,
>(
  zodObject: ZodObject<T, UnknownKeys, Catchall, Output, Input>,
  baseZodObject: ZodObject<T, UnknownKeys, Catchall, Output, Input> | undefined,
  state: SchemaState,
): oas31.SchemaObject | undefined => {
  if (!baseZodObject) {
    return undefined;
  }

  const component = state.components.schemas.get(baseZodObject);
  if (component ?? baseZodObject._def.openapi?.ref) {
    createSchemaObject(baseZodObject, state, ['extended schema']);
  }

  const completeComponent = state.components.schemas.get(baseZodObject);
  if (!completeComponent) {
    return undefined;
  }

  const diffOpts = createDiffOpts(
    {
      unknownKeys: baseZodObject._def.unknownKeys,
      catchAll: baseZodObject._def.catchall as ZodType,
    },
    {
      unknownKeys: zodObject._def.unknownKeys,
      catchAll: zodObject._def.catchall as ZodType,
    },
  );
  if (!diffOpts) {
    return undefined;
  }

  const diffShape = createShapeDiff(
    baseZodObject._def.shape() as ZodRawShape,
    zodObject._def.shape() as ZodRawShape,
  );

  if (!diffShape) {
    return undefined;
  }

  return {
    allOf: [{ $ref: createComponentSchemaRef(completeComponent.ref) }],
    ...createObjectSchemaFromShape(diffShape, diffOpts, state),
  };
};

const createDiffOpts = (
  baseOpts: AdditionalPropertyOptions,
  extendedOpts: AdditionalPropertyOptions,
): AdditionalPropertyOptions | undefined => {
  if (
    baseOpts.unknownKeys === 'strict' ||
    !isZodType(baseOpts.catchAll, 'ZodNever')
  ) {
    return undefined;
  }

  return {
    catchAll: extendedOpts.catchAll,
    unknownKeys: extendedOpts.unknownKeys,
  };
};

const createShapeDiff = (
  baseObj: ZodRawShape,
  extendedObj: ZodRawShape,
): ZodRawShape | null => {
  const acc: ZodRawShape = {};

  for (const [key, val] of Object.entries(extendedObj)) {
    const baseValue = baseObj[key];
    if (val === baseValue) {
      continue;
    }

    if (baseValue === undefined) {
      acc[key] = extendedObj[key] as ZodTypeAny;
      continue;
    }

    return null;
  }

  return acc;
};

interface AdditionalPropertyOptions {
  unknownKeys?: UnknownKeysParam;
  catchAll: ZodType;
}

export const createObjectSchemaFromShape = (
  shape: ZodRawShape,
  { unknownKeys, catchAll }: AdditionalPropertyOptions,
  state: SchemaState,
): oas31.SchemaObject => {
  const properties = mapProperties(shape, state);
  const required = mapRequired(shape, state);
  return {
    type: 'object',
    ...(properties && { properties }),
    ...(required && { required }),
    ...(unknownKeys === 'strict' && { additionalProperties: false }),
    ...(!isZodType(catchAll, 'ZodNever') && {
      additionalProperties: createSchemaObject(catchAll, state, [
        'additional properties',
      ]),
    }),
  };
};

export const mapRequired = (
  shape: ZodRawShape,
  state: SchemaState,
): oas31.SchemaObject['required'] => {
  const required: string[] = Object.entries(shape)
    .filter(([_key, zodSchema]) => !isOptionalSchema(zodSchema, state))
    .map(([key]) => key);

  if (!required.length) {
    return undefined;
  }

  return required;
};

export const mapProperties = (
  shape: ZodRawShape,
  state: SchemaState,
): oas31.SchemaObject['properties'] =>
  Object.entries(shape).reduce<NonNullable<oas31.SchemaObject['properties']>>(
    (acc, [key, zodSchema]): NonNullable<oas31.SchemaObject['properties']> => {
      acc[key] = createSchemaObject(zodSchema, state, [`property: ${key}`]);
      return acc;
    },
    {},
  );
