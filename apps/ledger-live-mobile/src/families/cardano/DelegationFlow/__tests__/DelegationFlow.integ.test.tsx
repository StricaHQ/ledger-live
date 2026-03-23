import "@ledgerhq/live-common/families/cardano/setup";
import React, { useEffect } from "react";
import { render, screen } from "@tests/test-renderer";
import { State } from "~/reducers/types";
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { component as DelegationFlow } from "../index";
import { server } from "@tests/server";
import { handlers } from "../../__tests__/handlers";
import BigNumber from "bignumber.js";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { getCardanoAccountFixture } from "@ledgerhq/coin-cardano/fixtures/accounts";
import { CardanoAccount } from "@ledgerhq/live-common/families/cardano/types";
import { NavigatorScreenParams } from "@react-navigation/native";
import { CardanoDelegationFlowParamList } from "../types";

jest.mock("LLM/hooks/useAccountScreen", () => ({
  useAccountScreen: () => ({ account: mockAccount, parentAccount: null }),
}));

jest.mock("@ledgerhq/live-common/bridge/useBridgeTransaction", () => ({
  __esModule: true,
  default: () => ({
    transaction: {
      family: "cardano",
      mode: "delegate",
      poolId: "00000000000000000000000000000000000000000000000000000001",
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
    createTransaction: jest.fn(() => ({ family: "cardano", mode: "delegate", poolId: null })),
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

const mockAccount: CardanoAccount = getCardanoAccountFixture({
  delegation: {
    rewards: new BigNumber("0"),
    status: false,
    poolId: undefined,
    dRepHex: undefined,
    deposit: "0",
  },
});
mockAccount.id = "test-cardano-account";
mockAccount.name = "Cardano Test Account";
mockAccount.currency.id = "cardano";
import { ScreenName } from "~/const";

type RootStackParamList = {
  Dummy: undefined;
  FlowRoot: NavigatorScreenParams<CardanoDelegationFlowParamList>;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const DummyScreen = ({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) => {
  useEffect(() => {
    navigation.navigate("FlowRoot", {
      screen: ScreenName.CardanoDelegationStarted,
      params: { accountId: mockAccount.id },
    });
  }, [navigation]);
  return null;
};

const TestNavigator = () => (
  <QueryClientProvider client={new QueryClient()}>
    <Stack.Navigator initialRouteName="Dummy">
      <Stack.Screen name="Dummy" component={DummyScreen} />
      <Stack.Screen name="FlowRoot" component={DelegationFlow} options={{ headerShown: false }} />
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

describe("DelegationFlow Integration", () => {
  beforeEach(() => {
    server.use(...handlers);
  });

  it("should navigate through the delegation flow", async () => {
    const { user } = render(<TestNavigator />, { ...INITIAL_STATE });

    // Step 1: Starter Screen -> Start delegation
    const startButton = await screen.findByTestId("cardano-delegation-start-button");
    await user.press(startButton);

    // Step 2: Summary Screen -> Change pool
    const validatorName = await screen.findByText("LBF1 - Ledger by Figment 1");
    expect(validatorName).toBeVisible();

    // Continue is pressed
    const continueButton = await screen.findByTestId("cardano-summary-continue-button");
    expect(continueButton).toBeVisible();
  });

  it("should display a bridge error if transaction preparation fails", async () => {
    jest
      .spyOn(require("@ledgerhq/live-common/bridge/useBridgeTransaction"), "default")
      .mockReturnValue({
        transaction: {
          family: "cardano",
          mode: "delegate",
          poolId: "00000000000000000000000000000000000000000000000000000001",
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
        bridgeError: new Error("Bridge network error"),
        bridgePending: false,
      });

    const { user } = render(<TestNavigator />, { ...INITIAL_STATE });

    // Step 1: Starter Screen -> Start delegation
    const startButton = await screen.findByTestId("cardano-delegation-start-button");
    await user.press(startButton);

    // Check if error boundary or alert shows up containing the error text
    const errorText = await screen.findByText(/Bridge network error/i);
    expect(errorText).toBeVisible();
  });
});
