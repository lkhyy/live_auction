import { z } from 'zod';

export const userRoleSchema = z.enum(['BUYER', 'HOST', 'ADMIN']);

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  displayName: z.string().min(1).max(50),
  role: userRoleSchema.default('BUYER'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
