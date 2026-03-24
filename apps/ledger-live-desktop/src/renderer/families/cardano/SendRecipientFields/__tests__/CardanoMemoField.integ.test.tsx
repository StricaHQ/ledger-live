import React from "react";
import { CardanoAccount, Transaction, TransactionStatus } from "@ledgerhq/coin-cardano/types";
import { render, screen, cleanup, fireEvent } from "tests/testSetup";
import BigNumber from "bignumber.js";
import { setSupportedCurrencies } from "@ledgerhq/live-common/currencies/index";
import { server } from "tests/server";
import SendRecipientFields from "../index";
import { getCardanoAccountFixture } from "@ledgerhq/coin-cardano/fixtures/accounts";
import { http, HttpResponse } from "msw";

setSupportedCurrencies(["cardano"]);

const mockAccount = getCardanoAccountFixture({});
mockAccount.id = "mock:1:cardano:true_cardano_0:";
mockAccount.currency.id = "cardano";

mockAccount.cardanoResources = {} as unknown as CardanoAccount["cardanoResources"];

const mockTransaction = {
  family: "cardano",
  amount: new BigNumber(0),
  recipient: "",
  memo: "",
};

const mockStatus = {
  errors: {},
  warnings: {},
  estimatedFees: new BigNumber(0),
  amount: new BigNumber(0),
  totalSpent: new BigNumber(0),
};

jest.mock("@ledgerhq/live-common/bridge/index", () => ({
  getAccountBridge: jest.fn(() => ({
    updateTransaction: jest.fn((t, patch) => ({ ...t, ...patch })),
  })),
}));

describe("CardanoMemoField Integration", () => {
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

  const handlers = [
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

  beforeEach(() => {
    server.use(...handlers);
  });

  afterEach(() => {
    cleanup();
  });

  it("should update transaction when memo is changed", async () => {
    const onChange = jest.fn();
    render(
      <SendRecipientFields.component
        account={mockAccount as unknown as CardanoAccount}
        transaction={mockTransaction as unknown as Transaction}
        status={mockStatus as unknown as TransactionStatus}
        onChange={onChange}
      />,
    );

    const memoInput = screen.getByRole("textbox");
    expect(memoInput).toBeInTheDocument();

    fireEvent.change(memoInput, { target: { value: "test memo" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        memo: "test memo",
      }),
    );
  });

  it("should display the existing memo from transaction", () => {
    const transactionWithMemo = { ...mockTransaction, memo: "existing memo" };
    const { container } = render(
      <SendRecipientFields.component
        account={mockAccount as unknown as CardanoAccount}
        transaction={transactionWithMemo as unknown as Transaction}
        status={mockStatus as unknown as TransactionStatus}
        onChange={jest.fn()}
      />,
    );

    const memoInput = container.querySelector("input");
    expect(memoInput).toHaveValue("existing memo");
  });

  it("should display a warning if the memo is invalid", () => {
    const errorStatus = {
      ...mockStatus,
      errors: {
        transaction: new Error("Memo is too long"),
      },
    };
    render(
      <SendRecipientFields.component
        account={mockAccount as unknown as CardanoAccount}
        transaction={mockTransaction as unknown as Transaction}
        status={errorStatus as unknown as TransactionStatus}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText(/Memo is too long/i)).toBeInTheDocument();
  });
});
