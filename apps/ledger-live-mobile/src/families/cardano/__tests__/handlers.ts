import { http, HttpResponse } from "msw";

const mockPools = [
  {
    poolId: "a314a18528d00c5fbd067ecb4a212cf2f307c83d2c08f44a11ebebf6",
    name: "Ledger by Figment 1",
    ticker: "LBF1",
    website: "https://www.ledger.com/coin/staking/cardano",
    cost: "170.0",
    margin: "6",
    pledge: "9.82",
    liveStake: "40.22",
    retiredEpoch: 618,
  },
  {
    poolId: "4a9c9902c9538da900b10b716d5d1b214487455fdb06028b32ffa180",
    name: "Ledger by Figment 2",
    ticker: "LBF2",
    website: "https://www.ledger.com/coin/staking/cardano",
    cost: "170.0",
    margin: "6",
    pledge: "9.82",
    liveStake: "91.69",
    retiredEpoch: 618,
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
  http.get("*/v1/pool/detail", () => {
    return HttpResponse.json({
      pools: [mockPools[0]],
    });
  }),
];

export default handlers;
