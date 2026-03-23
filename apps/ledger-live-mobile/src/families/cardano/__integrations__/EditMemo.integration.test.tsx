import React, { useEffect } from "react";
import { render, screen } from "@tests/test-renderer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { component as CardanoEditMemo } from "../EditMemo";
import BigNumber from "bignumber.js";
import { popToScreen } from "~/helpers/navigationHelpers";
import { ScreenName } from "~/const";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { getCardanoAccountFixture } from "@ledgerhq/coin-cardano/fixtures/accounts";

jest.mock("~/helpers/navigationHelpers", () => ({
  popToScreen: jest.fn(),
}));

const mockAccount = getCardanoAccountFixture({});
mockAccount.id = "test-cardano-account";
mockAccount.name = "Cardano Test";
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
      rewards: new BigNumber("0"),
      status: false,
      poolId: null,
      dRepHex: undefined,
      deposit: "0",
      stakeHex: "stake1test",
    } as any;
  },
});

const mockTransaction = {
  family: "cardano",
  mode: "send",
  memo: "",
};

jest.mock("@ledgerhq/live-common/bridge/index", () => ({
  getAccountBridge: jest.fn(() => ({
    updateTransaction: jest.fn((t, patch) => ({ ...t, ...patch })),
  })),
}));

const Stack = createNativeStackNavigator();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DummyScreen = ({ navigation }: any) => {
  useEffect(() => {
    navigation.navigate("CardanoEditMemo", {
      account: mockAccount,
      transaction: mockTransaction,
    });
  }, [navigation]);
  return null;
};

const TestNavigator = () => (
  <QueryClientProvider client={new QueryClient()}>
    <Stack.Navigator initialRouteName="Dummy">
      <Stack.Screen name="Dummy" component={DummyScreen} />
      <Stack.Screen
        name="CardanoEditMemo"
        component={CardanoEditMemo}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  </QueryClientProvider>
);

describe("EditMemo Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should type a memo and navigate back to SendSummary", async () => {
    const { user } = render(<TestNavigator />);

    const validateBtn = await screen.findByText(/validate/i);
    expect(validateBtn).toBeVisible();

    await user.press(validateBtn);

    expect(popToScreen).toHaveBeenCalledWith(
      expect.anything(),
      ScreenName.SendSummary,
      expect.objectContaining({
        accountId: mockAccount.id,
        transaction: expect.objectContaining({
          memo: "",
        }),
      }),
    );
  });
});
