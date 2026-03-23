import React from "react";
import { render, screen, waitFor, cleanup } from "tests/testSetup";
import BigNumber from "bignumber.js";
import { setSupportedCurrencies } from "@ledgerhq/live-common/currencies/index";
import { DeviceModelId } from "@ledgerhq/devices";
import { server } from "tests/server";
import { handlers } from "../../__integrations__/handlers";
import DelegationFlowModal from "../index";

setSupportedCurrencies(["cardano"]);

// Mock data generator for the account
const getMockAccountData = () => ({
  type: "Account",
  id: "mock:1:cardano:true_cardano_0:",
  seedIdentifier: "mock",
  name: "Cardano No Delegation",
  starred: false,
  used: false,
  derivationMode: "cardano",
  index: 0,
  freshAddress: "addr1_no_delegation",
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
  balance: new BigNumber("100000000"),
  spendableBalance: new BigNumber("100000000"),
  cardanoResources: {
    delegation: null,
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
      transaction: {
        mode: "delegate",
        poolId: "00000000000000000000000000000000000000000000000000000001",
        protocolParams: account.cardanoResources.protocolParams,
      },
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
    createTransaction: jest.fn(() => ({ mode: "delegate", poolId: null })),
    updateTransaction: jest.fn((t, patch) => ({ ...t, ...patch })),
    prepareTransaction: jest.fn(t => Promise.resolve(t)),
    getTransactionStatus: jest.fn(() =>
      Promise.resolve({
        errors: {},
        warnings: {},
        estimatedFees: new BigNumber("200000"),
      }),
    ),
  })),
}));

// We still mock useCardanoFamilyPools for now to avoid complexity of live-common registration in JSDOM,
// but we use the data from our MSW-matched mockPools.
jest.mock("@ledgerhq/live-common/families/cardano/react", () => ({
  useCardanoFamilyPools: jest.fn(() => ({
    pools: [
      {
        poolId: "00000000000000000000000000000000000000000000000000000001",
        name: "Ledger (Blockfrost)",
        ticker: "LDGR1",
        margin: "0.01",
        cost: "340000000",
        pledge: "50000000000",
        liveStake: "1000000000000",
        website: "https://ledger.com",
      },
      {
        poolId: "00000000000000000000000000000000000000000000000000000002",
        name: "Strica",
        ticker: "STRIC",
        margin: "0.02",
        cost: "340000000",
        pledge: "100000000000",
        liveStake: "2000000000000",
        website: "https://strica.io",
      },
    ],
    searchQuery: "",
    setSearchQuery: jest.fn(),
    onScrollEndReached: jest.fn(),
    isSearching: false,
    isPaginating: false,
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

jest.mock("../ScrollLoadingList", () => ({
  __esModule: true,
  default: ({ data, renderItem }: any) => {
    return (
      <div data-testid="scroll-loading-list">
        {data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((item: any) => item != null)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any, index: number) => renderItem(item, index))}
      </div>
    );
  },
}));

jest.mock("@ledgerhq/live-common/families/cardano/staking", () => ({
  ...jest.requireActual("@ledgerhq/live-common/families/cardano/staking"),
  fetchPoolDetails: jest.fn(() =>
    Promise.resolve({
      pools: [
        {
          poolId: "00000000000000000000000000000000000000000000000000000001",
          name: "Ledger (Blockfrost)",
          ticker: "LDGR1",
          margin: "0.01",
          cost: "340000000",
          pledge: "50000000000",
          liveStake: "1000000000000",
          website: "https://ledger.com",
        },
      ],
    }),
  ),
  fetchAndSortPools: jest.fn(() =>
    Promise.resolve([
      {
        poolId: "00000000000000000000000000000000000000000000000000000001",
        name: "Ledger (Blockfrost)",
        ticker: "LDGR1",
        margin: "0.01",
        cost: "340000000",
        pledge: "50000000000",
        liveStake: "1000000000000",
        website: "https://ledger.com",
      },
      {
        poolId: "00000000000000000000000000000000000000000000000000000002",
        name: "Strica",
        ticker: "STRIC",
        margin: "0.02",
        cost: "340000000",
        pledge: "100000000000",
        liveStake: "2000000000000",
        website: "https://strica.io",
      },
    ]),
  ),
}));

describe("Cardano DelegationFlowModal Integration", () => {
  beforeEach(() => {
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

  it("should navigate through the delegation flow", async () => {
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
        MODAL_CARDANO_DELEGATE: { isOpened: true, data: { account: mockAccountData } },
      },
    };

    const { user } = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <DelegationFlowModal account={mockAccountData as any} />,
      { initialState },
    );

    // Step 1: Validator Selection
    await waitFor(() => {
      expect(screen.getByText(/Ledger \(Blockfrost\)/i)).toBeInTheDocument();
    });

    const ledgerPool = screen.getByText(/Ledger \(Blockfrost\)/i);
    await user.click(ledgerPool);

    const continueButton = document.getElementById("delegate-continue-button");
    expect(continueButton).not.toBeDisabled();
    await user.click(continueButton!);

    // Step 2: Summary
    await waitFor(() => {
      expect(screen.getByText(/delegating to/i)).toBeInTheDocument();
    });
    // Validator name should be present in summary
    expect(screen.getByTestId("validator-name-label")).toHaveTextContent(/Ledger \(Blockfrost\)/i);

    const summaryContinueButton = document.getElementById("delegate-continue-button");
    await user.click(summaryContinueButton!);

    // Step 3: Connect Device (Generic)
    await waitFor(() => {
      expect(screen.getByTestId("device-action")).toBeInTheDocument();
    });
  });

  it("should display a bridge error if transaction preparation fails", async () => {
    jest.spyOn(require("@ledgerhq/live-common/bridge/useBridgeTransaction"), "default").mockReturnValue({
      transaction: {
        mode: "delegate",
        poolId: "00000000000000000000000000000000000000000000000000000001",
        protocolParams: getMockAccountData().cardanoResources.protocolParams,
      },
      setTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      account: getMockAccountData(),
      status: {
        errors: {},
        warnings: {},
        estimatedFees: new BigNumber("200000"),
        amount: new BigNumber("0"),
      },
      bridgeError: new Error("Network connection failed"),
      bridgePending: false,
    });
    
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
        MODAL_CARDANO_DELEGATE: { isOpened: true, data: { account: mockAccountData } },
      },
    };

    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <DelegationFlowModal account={mockAccountData as any} />,
      { initialState },
    );

    expect(await screen.findByText(/Network connection failed/i)).toBeInTheDocument();
  });
});
