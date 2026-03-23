import "@ledgerhq/live-common/families/cardano/setup";
import React, { useEffect } from "react";
import { render, screen } from "@tests/test-renderer";
import { State } from "~/reducers/types";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { component as UndelegationFlow } from "../index";
import { server } from "@tests/server";
import { handlers } from "../../__integrations__/handlers";
import BigNumber from "bignumber.js";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ScreenName } from "~/const";
import { getCardanoAccountFixture } from "@ledgerhq/coin-cardano/fixtures/accounts";

let mockRewardsValue = new BigNumber("0");
let mockDepositValue = "2000000";

const mockAccount = getCardanoAccountFixture({});
mockAccount.id = "test-cardano-account";
mockAccount.name = "Cardano Delegated Account";
mockAccount.currency.id = "cardano";
mockAccount.cardanoResources.protocolParams = {
  minFeeA: "44",
  minFeeB: "155381",
  minUtxo: "1000000",
  poolDeposit: "500000000",
  keyDeposit: "2000000",
  maxTxSize: 16384,
  maxValSize: 5000,
  collateralPercent: 150,
  maxCollateralInputs: 3,
  coinsPerUtxoByte: "4310",
} as any;
Object.defineProperty(mockAccount.cardanoResources, "delegation", {
  get() {
    return {
      rewards: mockRewardsValue,
      status: true,
      poolId: "00000000000000000000000000000000000000000000000000000001",
      dRepHex: undefined,
      deposit: mockDepositValue,
      stakeHex: "stake1test",
    } as any;
  },
});

jest.mock("LLM/hooks/useAccountScreen", () => ({
  useAccountScreen: () => ({ account: mockAccount, parentAccount: null }),
}));

jest.mock("@ledgerhq/live-common/bridge/useBridgeTransaction", () => ({
  __esModule: true,
  default: () => ({
    transaction: {
      family: "cardano",
      mode: "undelegate",
      protocolParams: mockAccount.cardanoResources?.protocolParams,
    },
    setTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    account: mockAccount,
    status: {
      errors: {},
      warnings: {},
      estimatedFees: new BigNumber("200000"),
      amount: new BigNumber("0"),
    },
    bridgeError: null,
    bridgePending: false,
  }),
}));

jest.mock("@ledgerhq/live-common/bridge/index", () => ({
  getAccountBridge: jest.fn(() => ({
    createTransaction: jest.fn(() => ({ family: "cardano", mode: "undelegate", poolId: null })),
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

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

const Stack = createNativeStackNavigator();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DummyScreen = ({ navigation }: any) => {
  useEffect(() => {
    navigation.navigate("FlowRoot", {
      screen: ScreenName.CardanoUndelegationSummary,
      params: { accountId: mockAccount.id },
    });
  }, [navigation]);
  return null;
};

const TestNavigator = () => (
  <QueryClientProvider client={new QueryClient()}>
    <Stack.Navigator initialRouteName="Dummy">
      <Stack.Screen name="Dummy" component={DummyScreen} />
      <Stack.Screen name="FlowRoot" component={UndelegationFlow} options={{ headerShown: false }} />
    </Stack.Navigator>
  </QueryClientProvider>
);

const INITIAL_STATE = {
  overrideInitialState: (state: State) => ({
    ...state,
    accounts: {
      active: [mockAccount],
    },
  }),
};

describe("UndelegationFlow Integration", () => {
  beforeEach(() => {
    server.use(...handlers);
  });

  it("should navigate through the undelegation flow without rewards", async () => {
    mockRewardsValue = new BigNumber("0");
    mockDepositValue = "0"; // no deposit refund when not previously registered
    render(<TestNavigator />, { ...INITIAL_STATE });

    // Summary screen should render and Continue button must be enabled
    const continueBtn = await screen.findByText(/continue/i);
    expect(continueBtn).toBeVisible();

    // undelegation message should be visible
    const undelegationMsg = await screen.findByText(
      /By un-delegating you will not receive any rewards/i,
    );
    expect(undelegationMsg).toBeVisible();
  });

  it("should navigate through the undelegation flow with rewards", async () => {
    mockRewardsValue = new BigNumber("1000000"); // 1 ADA reward
    mockDepositValue = "2000000"; // 2 ADA stake key deposit refund
    render(<TestNavigator />, { ...INITIAL_STATE });

    // Continue button must still be present and enabled
    const continueBtn = await screen.findByText(/continue/i);
    expect(continueBtn).toBeVisible();

    // Stake key registration deposit refund field must appear (reward-funded path)
    const depositRefundLabel = await screen.findByText(/Stake Key Registration deposit refund/i);
    expect(depositRefundLabel).toBeVisible();
  });

  it("should display an error if undelegation bridging fails", async () => {
    jest.spyOn(require("@ledgerhq/live-common/bridge/useBridgeTransaction"), "default").mockReturnValue({
      transaction: {
        family: "cardano",
        mode: "undelegate",
        protocolParams: mockAccount.cardanoResources?.protocolParams,
      },
      setTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      account: mockAccount,
      status: {
        errors: {},
        warnings: {},
        estimatedFees: new BigNumber("200000"),
        amount: new BigNumber("0"),
      },
      bridgeError: new Error("Undelegation network error"),
      bridgePending: false,
    });

    mockRewardsValue = new BigNumber("0");
    mockDepositValue = "0";
    
    render(<TestNavigator />, { ...INITIAL_STATE });

    const errorText = await screen.findByText(/Undelegation network error/i);
    expect(errorText).toBeVisible();
  });
});
