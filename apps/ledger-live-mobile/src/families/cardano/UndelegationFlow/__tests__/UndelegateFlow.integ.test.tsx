import "@ledgerhq/live-common/families/cardano/setup";
import React from "react";
import { render, screen } from "@tests/test-renderer";
import { State } from "~/reducers/types";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { component as UndelegationFlow } from "../index";
import CardanoDelegations from "../../Delegations";
import { server } from "@tests/server";
import { handlers } from "../../__tests__/handlers";
import BigNumber from "bignumber.js";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ScreenName, NavigatorName } from "~/const";
import { getCardanoAccountFixture } from "@ledgerhq/coin-cardano/fixtures/accounts";
import { NavigatorScreenParams } from "@react-navigation/native";
import { CardanoUndelegationFlowParamList } from "../types";
import * as useBridgeTransaction from "@ledgerhq/live-common/bridge/useBridgeTransaction";

let mockRewardsValue = new BigNumber("0");
let mockDepositValue = "2000000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAccount: any = getCardanoAccountFixture({
  delegation: {
    rewards: mockRewardsValue,
    status: true,
    poolId: "00000000000000000000000000000000000000000000000000000001",
    dRepHex: undefined,
    deposit: mockDepositValue,
  },
});
mockAccount.id = "test-cardano-account";
mockAccount.currency.id = "cardano";

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
    createTransaction: jest.fn(() => ({
      family: "cardano",
      mode: "undelegate",
      poolId: undefined,
    })),
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

type RootStackParamList = {
  Delegations: undefined;
  [NavigatorName.CardanoUndelegationFlow]: NavigatorScreenParams<CardanoUndelegationFlowParamList>;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const TestNavigator = () => (
  <QueryClientProvider client={new QueryClient()}>
    <Stack.Navigator initialRouteName="Delegations">
      <Stack.Screen name="Delegations">
        {() => <CardanoDelegations account={mockAccount} />}
      </Stack.Screen>
      <Stack.Screen
        name={NavigatorName.CardanoUndelegationFlow}
        component={UndelegationFlow}
        options={{ headerShown: false }}
      />
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

  it("should navigate through the full undelegation flow without rewards", async () => {
    mockRewardsValue = new BigNumber("0");
    mockDepositValue = "2000000";
    mockAccount.cardanoResources.delegation = {
      rewards: mockRewardsValue,
      status: true,
      poolId: "00000000000000000000000000000000000000000000000000000001",
      dRepHex: "drep1", // Set DRep to avoid self-tx path
      deposit: mockDepositValue,
      ticker: undefined,
      name: "Test Pool",
    };

    const { user } = render(<TestNavigator />, { ...INITIAL_STATE });

    await screen.findByTestId("cardano-delegation-list");

    const row = await screen.findByTestId("cardano-delegation-row");
    await user.press(row);

    const stopDelegationBtn = await screen.findByTestId("delegation-undelegate-action");
    await user.press(stopDelegationBtn);

    await screen.findByTestId(ScreenName.CardanoUndelegationSummary);

    expect(screen.getByTestId("undelegation-message")).toBeVisible();
    expect(screen.getByTestId("delegation-undelegate-continue")).toBeEnabled();
  });

  it("should show self-transaction info drawer when rewards are present with no DRep", async () => {
    mockRewardsValue = new BigNumber("1000000"); // 1 ADA rewards
    mockDepositValue = "2000000";
    mockAccount.cardanoResources.delegation = {
      rewards: mockRewardsValue,
      status: true,
      poolId: "00000000000000000000000000000000000000000000000000000001",
      dRepHex: undefined, // Trigger self-tx path
      deposit: mockDepositValue,
      ticker: undefined,
      name: "Test Pool",
    };

    const { user } = render(<TestNavigator />, { ...INITIAL_STATE });

    await screen.findByTestId("cardano-delegation-list");

    const row = await screen.findByTestId("cardano-delegation-row");
    await user.press(row);

    const stopDelegationBtn = await screen.findByTestId("delegation-undelegate-action");
    await user.press(stopDelegationBtn);

    const infoDrawer = await screen.findByTestId("cardano-undelegate-info-drawer");
    expect(infoDrawer).toBeVisible();

    expect(screen.getByTestId("drep-info-drawer-title")).toBeVisible();
    expect(screen.getByTestId("drep-info-drawer-desc")).toBeVisible();
  });

  it("should display a network error on summary screen if bridging fails", async () => {
    jest.spyOn(useBridgeTransaction, "default").mockReturnValue({
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    mockRewardsValue = new BigNumber("0");
    mockDepositValue = "2000000";
    mockAccount.cardanoResources.delegation = {
      rewards: mockRewardsValue,
      status: true,
      poolId: "00000000000000000000000000000000000000000000000000000001",
      dRepHex: "drep1",
      deposit: mockDepositValue,
      ticker: undefined,
      name: "Test Pool",
    };

    const { user } = render(<TestNavigator />, { ...INITIAL_STATE });

    const row = await screen.findByTestId("cardano-delegation-row");
    await user.press(row);
    const stopDelegationBtn = await screen.findByTestId("delegation-undelegate-action");
    await user.press(stopDelegationBtn);

    const errorText = await screen.findByText(/Undelegation network error/i);
    expect(errorText).toBeVisible();
  });
});
