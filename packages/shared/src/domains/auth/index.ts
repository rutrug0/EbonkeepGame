import { z } from "zod";

import { playerClassSchema } from "../../core/index.js";

export const registerBodySchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
  class: playerClassSchema
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const registerResponseSchema = z.object({
  accessToken: z.string(),
  accountId: z.string(),
  playerId: z.string()
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string()
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  accountId: z.string(),
  playerId: z.string()
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const accountOverviewResponseSchema = z.object({
  accountId: z.string(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  provider: z.string(),
  createdAt: z.string(),
  profile: z
    .object({
      playerId: z.string(),
      class: playerClassSchema,
      level: z.number().int().min(1),
      gearScore: z.number().int().min(0)
    })
    .nullable(),
  currency: z
    .object({
      ducats: z.number().int().min(0),
      imperials: z.number().int().min(0)
    })
    .nullable()
});
export type AccountOverviewResponse = z.infer<typeof accountOverviewResponseSchema>;

export const verifyEmailBodySchema = z.object({
  token: z.string().min(1)
});
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;

export const verifyEmailResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});
export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

export const forgotPasswordBodySchema = z.object({
  email: z.string().email()
});
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

export const forgotPasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100)
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export const resetPasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
