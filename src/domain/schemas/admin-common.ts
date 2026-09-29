import { z } from "zod";

const objectIdPattern = /^[a-f\d]{24}$/i;

export const adminEntityIdSchema = z
  .string()
  .trim()
  .regex(objectIdPattern, "شناسه معتبر نیست");
