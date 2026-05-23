import { z } from 'zod';

export const softCloseSchema = z.object({
  enabled: z.boolean().default(true),
  extensionSeconds: z.union([
    z.literal(10),
    z.literal(15),
    z.literal(20),
    z.literal(30),
  ]),
  triggerWindowSeconds: z.number().int().min(1).max(120).default(30),
  maxTotalExtensionSeconds: z.number().int().min(0).default(600),
});

export const auctionRuleSnapshotSchema = z.object({
  startPrice: z.number().min(0).default(0),
  minIncrement: z.number().positive(),
  capPrice: z.number().positive().optional(),
  durationSeconds: z.number().int().positive().default(300),
  softClose: softCloseSchema,
  allowHostCancel: z.boolean().default(true),
});

export type AuctionRuleSnapshot = z.infer<typeof auctionRuleSnapshotSchema>;
export type SoftCloseConfig = z.infer<typeof softCloseSchema>;

export const createAuctionSchema = z.object({
  lotId: z.string().uuid(),
  title: z.string().min(1).max(200),
  rules: auctionRuleSnapshotSchema,
  scheduledStartAt: z.string().datetime().optional(),
});

export const placeBidSchema = z.object({
  amount: z.number().positive(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
export type PlaceBidInput = z.infer<typeof placeBidSchema>;
