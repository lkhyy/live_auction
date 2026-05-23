import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const bidLatency = new Trend('bid_latency', true);
const bidErrors = new Counter('bid_errors');

export const options = {
  scenarios: {
    bids: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 300,
      maxVUs: 500,
    },
  },
  thresholds: {
    bid_latency: ['p(99)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const AUCTION_ID = __ENV.AUCTION_ID;
const TOKEN = __ENV.AUTH_TOKEN;

export function setup() {
  if (!AUCTION_ID || !TOKEN) {
    throw new Error('Set AUCTION_ID and AUTH_TOKEN environment variables');
  }
  return { auctionId: AUCTION_ID, token: TOKEN };
}

export default function (data) {
  const amount = 10 + Math.floor(Math.random() * 500) * 10;
  const res = http.post(
    `${BASE_URL}/auctions/${data.auctionId}/bids`,
    JSON.stringify({ amount }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.token}`,
        'Idempotency-Key': `${__VU}-${__ITER}-${Date.now()}`,
      },
    },
  );

  bidLatency.add(res.timings.duration);
  const ok = check(res, {
    'status 2xx or 409': (r) => r.status >= 200 && r.status < 500,
  });
  if (!ok) bidErrors.add(1);
  sleep(0.01);
}
