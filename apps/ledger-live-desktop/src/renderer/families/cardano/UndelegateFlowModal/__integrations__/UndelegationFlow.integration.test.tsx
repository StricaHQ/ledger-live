import React from "react";
import { render, screen, cleanup } from "tests/testSetup";
import BigNumber from "bignumber.js";
import { setSupportedCurrencies } from "@ledgerhq/live-common/currencies/index";
import { DeviceModelId } from "@ledgerhq/devices";
import { server } from "tests/server";
import { handlers } from "../../__integrations__/handlers";
import UndelegateFlowModal from "../index";
import { openModal } from "~/renderer/actions/modals";
import CardanoUndelegateSelfTxInfoModal from "../info/index";

setSupportedCurrencies(["cardano"]);

// Spied on in SELF_TX_INFO tests
jest.mock("~/renderer/actions/modals", () => ({
  openModal: jest.fn().mockReturnValue({ type: "OPEN_MODAL" }),
  closeModal: jest.fn().mockReturnValue({ type: "CLOSE_MODAL" }),
}));

let mockRewardsValue = new BigNumber("5000000");

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
      rewards: mockRewardsValue,
      dRepHex: undefined,
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

const setup = (overrides = {}) => {
  const mockAccountData = { ...getMockAccountData(), ...overrides };
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
      MODAL_CARDANO_UNDELEGATE_SELF_TX_INFO: {
        isOpened: false,
        data: { account: mockAccountData },
      },
    },
  };
  return { mockAccountData, initialState };
};

describe("Cardano Undelegation Integration", () => {
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

  // ── UndelegateFlowModal ────────────────────────────────────────────────────

  describe("UndelegateFlowModal", () => {
    it("should navigate through the undelegation flow without rewards", async () => {
      mockRewardsValue = new BigNumber("0");
      const { mockAccountData, initialState } = setup();
      const { user } = render(<UndelegateFlowModal account={mockAccountData as never} />, {
        initialState,
      });

      expect(
        await screen.findByText(/By un-delegating you will not receive any rewards/i),
      ).toBeInTheDocument();
      expect(await screen.findByTestId("undelegate-refund-label")).toBeInTheDocument();

      const continueButton = document.getElementById("undelegate-continue-button");
      expect(continueButton).not.toBeNull();
      expect(continueButton).not.toBeDisabled();
      await user.click(continueButton!);

      const deviceAction = await screen.findByTestId("device-action");
      expect(deviceAction).toBeInTheDocument();
    });

    it("should navigate through the undelegation flow with rewards", async () => {
      mockRewardsValue = new BigNumber("5000000"); // 5 ADA
      const { mockAccountData, initialState } = setup();
      const { user } = render(<UndelegateFlowModal account={mockAccountData as never} />, {
        initialState,
      });

      expect(
        await screen.findByText(/By un-delegating you will not receive any rewards/i),
      ).toBeInTheDocument();
      expect(await screen.findByTestId("undelegate-refund-label")).toBeInTheDocument();

      const continueButton = document.getElementById("undelegate-continue-button");
      expect(continueButton).not.toBeNull();
      expect(continueButton).not.toBeDisabled();
      await user.click(continueButton!);

      const deviceAction = await screen.findByTestId("device-action");
      expect(deviceAction).toBeInTheDocument();
    });
  });

  // ── MODAL_CARDANO_UNDELEGATE_SELF_TX_INFO (rewards → self tx → MODAL_SEND) ──

  describe("CardanoUndelegateSelfTxInfoModal", () => {
    const selfTxSetup = () => {
      const mockAccountData = getMockAccountData();
      const initialState = {
        modals: {
          MODAL_CARDANO_UNDELEGATE_SELF_TX_INFO: {
            isOpened: true,
            data: { account: mockAccountData },
          },
        },
      };
      return { mockAccountData, initialState };
    };

    it("should render the info modal with a Continue button", async () => {
      const { mockAccountData, initialState } = selfTxSetup();
      render(<CardanoUndelegateSelfTxInfoModal account={mockAccountData as never} />, {
        initialState,
      });

      const continueButton = await screen.findByTestId("modal-continue-button");
      expect(continueButton).toBeInTheDocument();
    });

    it("should dispatch MODAL_SEND when Continue is clicked (rewards → self tx flow)", async () => {
      const { mockAccountData, initialState } = selfTxSetup();
      const { user } = render(
        <CardanoUndelegateSelfTxInfoModal account={mockAccountData as never} />,
        { initialState },
      );

      const continueButton = await screen.findByTestId("modal-continue-button");
      expect(continueButton).not.toBeDisabled();
      await user.click(continueButton);

      // After clicking Continue, MODAL_SEND should be opened to perform a self-tx
      // that brings the account below the min UTxO threshold, allowing un-staking.
      expect(openModal).toHaveBeenCalledWith("MODAL_SEND", {
        account: expect.objectContaining({ id: mockAccountData.id }),
        recipient: mockAccountData.freshAddress,
        amount: expect.anything(),
      });
    });
  });
});
