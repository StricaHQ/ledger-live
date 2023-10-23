import { expect } from "detox";
import { DeviceModelId } from "@ledgerhq/devices";
import { loadBleState, loadConfig } from "../../bridge/server";
import PortfolioPage from "../../models/wallet/portfolioPage";
import DeviceAction from "../../models/DeviceAction";
import AccountPage from "../../models/accounts/accountPage";
import AddAccountDrawer from "../../models/accounts/addAccountDrawer";
import { getElementByText, waitForElementByText } from "../../helpers";

let portfolioPage: PortfolioPage;
let deviceAction: DeviceAction;
let addAccountDrawer: AddAccountDrawer;

const knownDevice = {
  name: "Nano X de test",
  id: "mock_1",
  modelId: DeviceModelId.nanoX,
};

describe("Add Bitcoin Accounts", () => {
  beforeAll(async () => {
    loadConfig("onboardingcompleted", true);
    loadBleState({ knownDevices: [knownDevice] });

    portfolioPage = new PortfolioPage();
    deviceAction = new DeviceAction(knownDevice);
    addAccountDrawer = new AddAccountDrawer();

    await portfolioPage.waitForPortfolioPageToLoad();
  });

  it("open add accounts from portfolio", async () => {
    await addAccountDrawer.openViaDeeplink();
  });

  it("add Bitcoin accounts", async () => {
    await addAccountDrawer.selectCurrency("bitcoin");
    await deviceAction.selectMockDevice();
    await deviceAction.openApp();
    await addAccountDrawer.startAccountsDiscovery();
    await expect(getElementByText("Bitcoin 2")).toBeVisible();
    await addAccountDrawer.finishAccountsDiscovery();
    await addAccountDrawer.tapSuccessCta();
  });

  it("displays Bitcoin accounts page summary", async () => {
    await expect(getElementByText("Your Bitcoin")).toBeVisible();

    await waitForElementByText("1.19576 BTC");
  });
});
