import { readFileSync } from 'fs';
import { join } from 'path';

export const PLACE_BID_SCRIPT = readFileSync(
  join(__dirname, 'scripts', 'place-bid.lua'),
  'utf-8',
);

export interface LuaBidSuccess {
  ok: true;
  currentPrice: number;
  leaderId: string;
  leaderDisplayName: string;
  endAt: number;
  version: number;
  seq: number;
  leaderboard: Array<{ userId: string; displayName: string; amount: number }>;
  settledByCap: number;
  status: string;
  totalExtendedMs: number;
  extended?: number;
  previousLeaderId?: string;
}

export interface LuaBidFailure {
  ok: false;
  code: string;
  minRequired?: number;
  version?: number;
}

export type LuaBidResult = LuaBidSuccess | LuaBidFailure;
