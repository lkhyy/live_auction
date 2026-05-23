# Load Tests

## Prerequisites

- API running with a **LIVE** auction
- Auth token for a buyer account
- [k6](https://k6.io/) installed for HTTP bid load test
- [Artillery](https://www.artillery.io/) for WebSocket connection test

## HTTP bid load (200/s for 60s)

```bash
export API_URL=http://localhost:3000
export AUCTION_ID=<live-auction-uuid>
export AUTH_TOKEN=<jwt-access-token>

k6 run load-tests/k6-bid-load.js
```

Target: P99 bid latency < 500ms, error rate < 5%.

## WebSocket connections (~1500 over scaled runs)

```bash
npm install -g artillery@2
export AUCTION_ID=<live-auction-uuid>

# Run multiple instances or increase arrivalRate to approach 1500 concurrent sockets
artillery run load-tests/artillery-ws.yml
```

For 1500 concurrent connections, run on a machine with sufficient file descriptors and scale `arrivalRate` / `duration` in the YAML.
