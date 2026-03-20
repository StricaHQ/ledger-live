import "@ledgerhq/live-common/families/cardano/setup";
import React, { useEffect } from "react";
import { render, screen } from "@tests/test-renderer";
import { State } from "~/reducers/types";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { component as UndelegationFlow } from "../index";
import { server } from "@tests/server";
import { handlers } from "../../__integrations__/handlers";
import { CardanoAccount } from "@ledgerhq/live-common/families/cardano/types";
import BigNumber from "bignumber.js";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ScreenName } from "~/const";

let mockRewardsValue = new BigNumber("0");

const mockAccount: CardanoAccount = {
  type: "Account",
  id: "test-cardano-account",
  seedIdentifier: "seed",  
  derivationMode: "",
  index: 0,
  freshAddress: "addr1test",
  freshAddressPath: "",
  freshAddresses: [],
  name: "Cardano Delegated Account",
  starred: false,
  used: false,
  balance: new BigNumber("100000000000"), // 100k ADA
  spendableBalance: new BigNumber("100000000000"),
  creationDate: new Date(),
  blockHeight: 100,
  currency: {
    id: "cardano",
    name: "Cardano",
    type: "CryptoCurrency",
    ticker: "ADA",
    family: "cardano",
    color: "#000",
    managerAppName: "Cardano ADA",
    explorerViews: [],
    units: [{ name: "ADA", code: "ADA", magnitude: 6 }],
  },
  operationsCount: 0,
  operations: [],
  pendingOperations: [],
  lastSyncDate: new Date(),
  balanceHistoryCache: {
    HOUR: { latestDate: null, balances: [] },
    DAY: { latestDate: null, balances: [] },
    WEEK: { latestDate: null, balances: [] },
  },
  swapHistory: [],
  cardanoResources: {
    protocolParams: {
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
    },
    get delegation() {
      return {
        rewards: mockRewardsValue,
        status: true,
        poolId: "00000000000000000000000000000000000000000000000000000001",
        dRepHex: undefined,
        deposit: "2000000",
        stakeHex: "stake1test",
      };
    },
  },
} as unknown as CardanoAccount;

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
      <Stack.Screen
        name="FlowRoot"
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

  it("should navigate through the undelegation flow without rewards", async () => {
    mockRewardsValue = new BigNumber("0");
    render(<TestNavigator />, { ...INITIAL_STATE });

    // Step 1: Summary Screen -> Validate Continue button is present
    const continueBtn = await screen.findByText(/continue/i);
    expect(continueBtn).toBeVisible();
  });

  it("should navigate through the undelegation flow with rewards", async () => {
    mockRewardsValue = new BigNumber("1000000"); // 1 ADA reward
    render(<TestNavigator />, { ...INITIAL_STATE });

    // Step 1: Summary Screen -> Validate Continue button is present
    const continueBtn = await screen.findByText(/continue/i);
    expect(continueBtn).toBeVisible();
  });
});
