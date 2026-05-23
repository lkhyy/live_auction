import { PrismaClient, UserRole, LotStatus, AuctionStatus, LiveRoomStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROOM_ID = '00000000-0000-4000-8000-00000000ROOM';
const rules = {
  startPrice: 100,
  minIncrement: 10,
  durationSeconds: 600,
  capPrice: 5000,
  softClose: {
    enabled: true,
    extensionSeconds: 15,
    triggerWindowSeconds: 30,
    maxTotalExtensionSeconds: 600,
  },
  allowHostCancel: true,
};

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const host = await prisma.user.upsert({
    where: { email: 'host@example.com' },
    update: {},
    create: {
      email: 'host@example.com',
      passwordHash,
      displayName: '主播小美',
      role: UserRole.HOST,
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@example.com' },
    update: {},
    create: {
      email: 'buyer@example.com',
      passwordHash,
      displayName: 'Demo Buyer',
      role: UserRole.BUYER,
    },
  });

  await prisma.user.upsert({
    where: { email: 'buyer2@example.com' },
    update: {},
    create: {
      email: 'buyer2@example.com',
      passwordHash,
      displayName: 'Demo Buyer 2',
      role: UserRole.BUYER,
    },
  });

  const img =
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400';

  const lots = await Promise.all(
    [
      { id: '00000000-0000-4000-8000-000000000001', title: '18K金钻石项链' },
      { id: '00000000-0000-4000-8000-000000000002', title: '冰种翡翠手镯' },
      { id: '00000000-0000-4000-8000-000000000003', title: '劳力士水鬼腕表' },
      { id: '00000000-0000-4000-8000-000000000004', title: '爱马仕铂金包' },
      { id: '00000000-0000-4000-8000-000000000005', title: '天然珍珠耳环' },
    ].map((l) =>
      prisma.lot.upsert({
        where: { id: l.id },
        update: { title: l.title, imageUrl: img, status: LotStatus.ACTIVE },
        create: {
          id: l.id,
          hostId: host.id,
          title: l.title,
          description: `${l.title} — 演示商品`,
          imageUrl: img,
          category: 'jewelry',
          status: LotStatus.ACTIVE,
        },
      }),
    ),
  );

  await prisma.liveRoom.upsert({
    where: { id: ROOM_ID },
    update: { title: '进主播橱窗 · 珠宝专场', status: LiveRoomStatus.LIVE },
    create: {
      id: ROOM_ID,
      hostId: host.id,
      title: '进主播橱窗 · 珠宝专场',
      status: LiveRoomStatus.LIVE,
      startedAt: new Date(),
    },
  });

  const auctionDefs: Array<{
    id: string;
    lotIdx: number;
    title: string;
    sortOrder: number;
    status: AuctionStatus;
    currentPrice: number;
    winnerId?: string;
    active?: boolean;
  }> = [
    {
      id: '00000000-0000-4000-8000-00000000A01',
      lotIdx: 1,
      title: lots[1].title,
      sortOrder: 1,
      status: AuctionStatus.LIVE,
      currentPrice: 120,
      active: true,
    },
    {
      id: '00000000-0000-4000-8000-00000000A02',
      lotIdx: 0,
      title: lots[0].title,
      sortOrder: 2,
      status: AuctionStatus.SCHEDULED,
      currentPrice: 100,
    },
    {
      id: '00000000-0000-4000-8000-00000000A03',
      lotIdx: 2,
      title: lots[2].title,
      sortOrder: 3,
      status: AuctionStatus.SETTLED,
      currentPrice: 100,
    },
    {
      id: '00000000-0000-4000-8000-00000000A04',
      lotIdx: 3,
      title: lots[3].title,
      sortOrder: 4,
      status: AuctionStatus.SETTLED,
      currentPrice: 3200,
      winnerId: buyer.id,
    },
    {
      id: '00000000-0000-4000-8000-00000000A05',
      lotIdx: 4,
      title: lots[4].title,
      sortOrder: 5,
      status: AuctionStatus.CLOSING,
      currentPrice: 880,
    },
  ];

  for (const a of auctionDefs) {
    await prisma.auction.upsert({
      where: { id: a.id },
      update: {
        roomId: ROOM_ID,
        sortOrder: a.sortOrder,
        status: a.status,
        currentPrice: a.currentPrice,
        winnerId: a.winnerId ?? null,
        title: a.title,
        ruleSnapshot: rules,
      },
      create: {
        id: a.id,
        lotId: lots[a.lotIdx].id,
        hostId: host.id,
        roomId: ROOM_ID,
        sortOrder: a.sortOrder,
        title: a.title,
        status: a.status,
        ruleSnapshot: rules,
        capPrice: 5000,
        currentPrice: a.currentPrice,
        winnerId: a.winnerId ?? null,
        startAt: a.status === AuctionStatus.LIVE ? new Date() : null,
        endAt:
          a.status === AuctionStatus.LIVE
            ? new Date(Date.now() + 600_000)
            : null,
      },
    });
  }

  await prisma.liveRoom.update({
    where: { id: ROOM_ID },
    data: { activeAuctionId: '00000000-0000-4000-8000-00000000A01' },
  });

  console.log('Seed complete. Demo live room:', ROOM_ID);
  console.log('Open H5: /m/room/' + ROOM_ID);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
