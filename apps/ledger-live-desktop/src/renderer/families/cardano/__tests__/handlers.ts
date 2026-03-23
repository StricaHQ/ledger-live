import { http, HttpResponse } from "msw";

const mockPools = [
  {
    poolId: "00000000000000000000000000000000000000000000000000000001",
    name: "Ledger (Blockfrost)",
    ticker: "LDGR1",
    website: "https://ledger.com",
    cost: "340000000",
    margin: "0.01",
    pledge: "50000000000",
    liveStake: "1000000000000",
    retiredEpoch: undefined,
  },
  {
    poolId: "00000000000000000000000000000000000000000000000000000002",
    name: "Strica",
    ticker: "STRIC",
    website: "https://strica.io",
    cost: "340000000",
    margin: "0.02",
    pledge: "100000000000",
    liveStake: "2000000000000",
    retiredEpoch: undefined,
  },
];

export const handlers = [
  http.get("*/v1/pool/list", () => {
    return HttpResponse.json({
      pageNo: 1,
      limit: 10,
      count: mockPools.length,
      pools: mockPools,
    });
  }),
  http.get("*/v1/pool/detail", ({ request }) => {
    const url = new URL(request.url);
    const poolIds = url.searchParams.getAll("poolIds");
    const filteredPools = mockPools.filter(p => poolIds.includes(p.poolId));
    return HttpResponse.json({
      pools: filteredPools,
    });
  }),
];

export default handlers;
