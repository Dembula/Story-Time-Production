import type { Prisma } from "../../generated/prisma";

const { Prisma: PrismaRuntime } = require("../../generated/prisma") as {
  Prisma: {
    DbNull: Prisma.NullableJsonNullValueInput;
    JsonNull: Prisma.NullableJsonNullValueInput;
  };
};

export type InputJsonValue = Prisma.InputJsonValue;
export type NullableJsonNullValueInput = Prisma.NullableJsonNullValueInput;

/** Set a nullable JSON column to SQL NULL. */
export const prismaDbNull = PrismaRuntime.DbNull;

/** Set a nullable JSON column to the JSON `null` literal. */
export const prismaJsonNull = PrismaRuntime.JsonNull;
