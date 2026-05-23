import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('place-bid Lua script file', () => {
  it('exists and contains atomic bid logic', () => {
    const script = readFileSync(join(__dirname, 'scripts', 'place-bid.lua'), 'utf-8');
    expect(script).toContain('ZADD');
    expect(script).toContain('softClose');
    expect(script).toContain('settledByCap');
    expect(script).toContain('VERSION_CONFLICT');
  });
});
