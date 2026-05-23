-- KEYS[1] = auction state hash key
-- KEYS[2] = auction bids zset key
-- KEYS[3] = auction seq key
-- ARGV[1] = userId
-- ARGV[2] = displayName
-- ARGV[3] = amount (number)
-- ARGV[4] = nowMs
-- ARGV[5] = minIncrement
-- ARGV[6] = capPrice (empty string if none)
-- ARGV[7] = softCloseEnabled (0|1)
-- ARGV[8] = extensionSeconds
-- ARGV[9] = triggerWindowSeconds
-- ARGV[10] = maxTotalExtensionSeconds
-- ARGV[11] = expectedVersion (-1 to skip)
-- ARGV[12] = totalExtendedSoFar

local stateKey = KEYS[1]
local zsetKey = KEYS[2]
local seqKey = KEYS[3]

local userId = ARGV[1]
local displayName = ARGV[2]
local amount = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])
local minIncrement = tonumber(ARGV[5])
local capPriceStr = ARGV[6]
local capPrice = nil
if capPriceStr ~= nil and capPriceStr ~= '' then
  capPrice = tonumber(capPriceStr)
end
local softCloseEnabled = tonumber(ARGV[7]) == 1
local extensionSeconds = tonumber(ARGV[8])
local triggerWindowSeconds = tonumber(ARGV[9])
local maxTotalExtension = tonumber(ARGV[10])
local expectedVersion = tonumber(ARGV[11])
local totalExtendedSoFar = tonumber(ARGV[12])

local status = redis.call('HGET', stateKey, 'status')
if status ~= 'LIVE' then
  return cjson.encode({ ok = false, code = 'AUCTION_NOT_LIVE' })
end

local endAt = tonumber(redis.call('HGET', stateKey, 'endAt') or '0')
if nowMs >= endAt then
  return cjson.encode({ ok = false, code = 'AUCTION_ENDED' })
end

local version = tonumber(redis.call('HGET', stateKey, 'version') or '0')
if expectedVersion >= 0 and expectedVersion ~= version then
  return cjson.encode({ ok = false, code = 'VERSION_CONFLICT', version = version })
end

local startPrice = tonumber(redis.call('HGET', stateKey, 'startPrice') or '0')
local currentPrice = tonumber(redis.call('HGET', stateKey, 'currentPrice') or '0')
local bidCount = redis.call('ZCARD', zsetKey)

local minRequired
if bidCount == 0 then
  minRequired = startPrice
else
  minRequired = currentPrice + minIncrement
end

if amount < minRequired then
  return cjson.encode({ ok = false, code = 'BID_TOO_LOW', minRequired = minRequired })
end

local finalAmount = amount
local settledByCap = 0
if capPrice ~= nil then
  if amount >= capPrice then
    finalAmount = capPrice
    settledByCap = 1
  end
end

local prevEndAt = endAt
local newEndAt = endAt
local extended = 0
if softCloseEnabled and settledByCap == 0 then
  local windowStart = endAt - (triggerWindowSeconds * 1000)
  if nowMs >= windowStart then
    local extensionMs = extensionSeconds * 1000
    local proposedEnd = nowMs + extensionMs
    local added = proposedEnd - endAt
    if added > 0 then
      local allowed = maxTotalExtension * 1000 - totalExtendedSoFar
      if allowed > 0 then
        if added > allowed then
          added = allowed
          proposedEnd = endAt + added
        end
        newEndAt = proposedEnd
        totalExtendedSoFar = totalExtendedSoFar + added
        extended = 1
      end
    end
  end
end

local previousLeaderId = redis.call('HGET', stateKey, 'leaderId') or ''

redis.call('HSET', stateKey, 'currentPrice', finalAmount)
redis.call('HSET', stateKey, 'leaderId', userId)
redis.call('HSET', stateKey, 'leaderDisplayName', displayName)
redis.call('HSET', stateKey, 'previousLeaderId', previousLeaderId)
redis.call('HSET', stateKey, 'endAt', newEndAt)
redis.call('HSET', stateKey, 'totalExtendedMs', totalExtendedSoFar)
version = redis.call('HINCRBY', stateKey, 'version', 1)
local seq = redis.call('INCR', seqKey)

redis.call('ZADD', zsetKey, finalAmount, userId .. ':' .. displayName)

local topRaw = redis.call('ZREVRANGE', zsetKey, 0, 19, 'WITHSCORES')
local leaderboard = {}
for i = 1, #topRaw, 2 do
  local member = topRaw[i]
  local score = tonumber(topRaw[i + 1])
  local colonPos = string.find(member, ':')
  local uid = member
  local dname = ''
  if colonPos then
    uid = string.sub(member, 1, colonPos - 1)
    dname = string.sub(member, colonPos + 1)
  end
  table.insert(leaderboard, { userId = uid, displayName = dname, amount = score })
end

local newStatus = 'LIVE'
if settledByCap == 1 then
  newStatus = 'SETTLED'
  redis.call('HSET', stateKey, 'status', 'SETTLED')
  redis.call('HSET', stateKey, 'settleReason', 'CAP_PRICE')
end

return cjson.encode({
  ok = true,
  currentPrice = finalAmount,
  leaderId = userId,
  leaderDisplayName = displayName,
  endAt = newEndAt,
  version = version,
  seq = seq,
  leaderboard = leaderboard,
  settledByCap = settledByCap,
  status = newStatus,
  totalExtendedMs = totalExtendedSoFar,
  extended = extended,
  previousLeaderId = previousLeaderId,
})
