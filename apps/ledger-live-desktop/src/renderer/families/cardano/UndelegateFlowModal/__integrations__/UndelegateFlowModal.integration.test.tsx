import React from "react";
import { render, screen, waitFor, cleanup } from "tests/testSetup";
import BigNumber from "bignumber.js";
import { setSupportedCurrencies } from "@ledgerhq/live-common/currencies/index";
import { DeviceModelId } from "@ledgerhq/devices";
import { server } from "tests/server";
import { handlers } from "../../__integrations__/handlers";
import UndelegateFlowModal from "../index";

setSupportedCurrencies(["cardano"]);

const getMockAccountData = () => ({
  type: "Account",
  id: "mock:1:cardano:true_cardano_0:",
  seedIdentifier: "mock",
  name: "Cardano Delegated",
  starred: false,
  used: false,
  derivationMode: "cardano",
  index: 0,
  freshAddress: "addr1_delegated",
  freshAddressPath: "1852'/1815'/0'/0/0",
  blockHeight: 100000,
  creationDate: new Date("2023-01-01T00:00:00.000Z"),
  operationsCount: 10,
  operations: [],
  pendingOperations: [],
  currencyId: "cardano",
  currency: {
    id: "cardano",
    name: "Cardano",
    type: "CryptoCurrency",
    ticker: "ADA",
    units: [{ name: "ada", code: "ADA", magnitude: 6 }],
  },
  unitMagnitude: 6,
  lastSyncDate: new Date("2023-10-01T00:00:00.000Z"),
  balance: new BigNumber("105000000"),
  spendableBalance: new BigNumber("105000000"),
  cardanoResources: {
    delegation: {
      poolId: "pool1_ledger",
      status: "active",
      rewards: new BigNumber("5000000"),
    },
    protocolParams: {
      stakeKeyDeposit: "2000000",
    },
  },
});

jest.mock("@ledgerhq/live-common/bridge/useBridgeTransaction", () => ({
  __esModule: true,
  default: () => {
    const account = getMockAccountData();
    return {
      transaction: { mode: "undelegate" },
      setTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      account,
      status: {
        errors: {},
        warnings: {},
        estimatedFees: new BigNumber("200000"),
        amount: new BigNumber("0"),
      },
      bridgeError: null,
      bridgePending: false,
    };
  },
}));

jest.mock("@ledgerhq/live-common/bridge/index", () => ({
  getAccountBridge: jest.fn(() => ({
    createTransaction: jest.fn(() => ({ mode: "undelegate" })),
    updateTransaction: jest.fn((t, patch) => ({ ...t, ...patch })),
    prepareTransaction: jest.fn(t => Promise.resolve(t)),
    getTransactionStatus: jest.fn(() =>
      Promise.resolve({ errors: {}, warnings: {}, estimatedFees: new BigNumber("200000") }),
    ),
  })),
}));

jest.mock("~/renderer/families", () => ({
  getLLDCoinFamily: jest.fn(() => ({})),
}));

jest.mock("~/renderer/modals/Send/AccountFooter", () => ({
  __esModule: true,
  default: () => <div data-testid="account-footer">Mock Account Footer</div>,
}));

jest.mock("~/renderer/components/DeviceAction", () => ({
  __esModule: true,
  default: () => <div data-testid="device-action">Mock Device Action</div>,
}));

describe("Cardano UndelegateFlowModal Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    server.use(...handlers);

    if (!document.getElementById("modals")) {
      const modalsRoot = document.createElement("div");
      modalsRoot.id = "modals";
      document.body.appendChild(modalsRoot);
    }
  });

  afterEach(() => {
    cleanup();
    document.getElementById("modals")?.remove();
  });

  it("should navigate through the undelegation flow", async () => {
    const mockAccountData = getMockAccountData();
    const initialState = {
      devices: {
        currentDevice: {
          deviceId: "test",
          modelId: DeviceModelId.nanoS,
          wired: true,
        },
      },
      modals: {
        MODAL_CARDANO_UNDELEGATE: { isOpened: true, data: { account: mockAccountData } },
      },
    };

    const { user } = render(<UndelegateFlowModal account={mockAccountData as any} />, {
      initialState,
    });

    // Step 1: Summary
    await waitFor(() => {
      expect(
        screen.getByText(/By un-delegating you will not receive any rewards/i),
      ).toBeInTheDocument();
    });

    // Check refund label
    expect(screen.getByTestId("undelegate-refund-label")).toBeInTheDocument();

    const continueButton = document.getElementById("undelegate-continue-button");
    expect(continueButton).not.toBeDisabled();
    await user.click(continueButton!);

    // Step 2: Connect Device
    await waitFor(() => {
      expect(screen.getByTestId("device-action")).toBeInTheDocument();
    });
  });
});
