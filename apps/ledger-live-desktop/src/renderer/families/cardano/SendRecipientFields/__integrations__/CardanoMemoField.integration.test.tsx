import React from "react";
import { render, screen, cleanup, fireEvent } from "tests/testSetup";
import BigNumber from "bignumber.js";
import { setSupportedCurrencies } from "@ledgerhq/live-common/currencies/index";
import { server } from "tests/server";
import { handlers } from "../../__integrations__/handlers";
import SendRecipientFields from "../index";

setSupportedCurrencies(["cardano"]);

const mockAccount = {
  type: "Account",
  id: "mock:1:cardano:true_cardano_0:",
  name: "Cardano Account",
  currency: {
    id: "cardano",
    name: "Cardano",
    type: "CryptoCurrency",
    ticker: "ADA",
    units: [{ name: "ada", code: "ADA", magnitude: 6 }],
  },
  cardanoResources: {},
};

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
        account={mockAccount as any}
        transaction={mockTransaction as any}
        status={mockStatus as any}
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
        account={mockAccount as any}
        transaction={transactionWithMemo as any}
        status={mockStatus as any}
        onChange={jest.fn()}
      />,
    );

    const memoInput = container.querySelector("input");
    expect(memoInput).toHaveValue("existing memo");
  });
});
