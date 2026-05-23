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

export type UserRole = z.infer<typeof userRoleSchema>;
