import React from "react";
import { render, screen, fireEvent } from "tests/testSetup";
import DRepRow from "./DRepRow";
import { openURL } from "~/renderer/linking";
import { getDefaultExplorerView, getDRepExplorer } from "@ledgerhq/live-common/explorers";
import { CryptoCurrency } from "@ledgerhq/types-cryptoassets";
import { DRep } from "@ledgerhq/live-common/families/cardano/DRep";

jest.mock("~/renderer/linking", () => ({
  openURL: jest.fn(),
}));

jest.mock("@ledgerhq/live-common/explorers", () => ({
  getDefaultExplorerView: jest.fn(),
  getDRepExplorer: jest.fn(),
}));

jest.mock("~/renderer/hooks/useDateFormatter", () => ({
  useDateFormatter: () => (_date: Date) => "Formatted Date",
  dayAndHourFormat: "dayAndHourFormat",
}));

jest.mock("~/renderer/components/DRep/DRepRow", () => {
  return function MockDRepRow({
    onClick,
    onExternalLink,
    title,
    subtitle,
    lastActiveOn,
  }: {
    onClick: () => void;
    onExternalLink: (hex: string) => void;
    title: string;
    subtitle: string;
    lastActiveOn: string;
  }) {
    return (
      <div data-testid="drep-row" onClick={onClick}>
        <span>{title}</span>
        <span>{subtitle}</span>
        <span>{lastActiveOn}</span>
        <button
          data-testid="external-link"
          onClick={e => {
            e.stopPropagation();
            onExternalLink(subtitle);
          }}
        >
          Link
        </button>
      </div>
    );
  };
});

describe("DRepRow", () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const mockCurrency = { type: "CryptoCurrency", id: "cardano" } as CryptoCurrency;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const mockDRep = {
    hex: "drep123",
    meta: { givenName: "Test DRep" },
    active: "2023-01-01T00:00:00.000Z",
  } as DRep;
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with DRep name, hex, and last active date", () => {
    render(<DRepRow currency={mockCurrency} DRep={mockDRep} onClick={mockOnClick} />);

    expect(screen.getByText("Test DRep")).toBeInTheDocument();
    expect(screen.getByText("drep123")).toBeInTheDocument();
    expect(screen.getByText("Formatted Date")).toBeInTheDocument();
  });

  it("calls onClick with the DRep when row is clicked", () => {
    render(<DRepRow currency={mockCurrency} DRep={mockDRep} onClick={mockOnClick} />);

    fireEvent.click(screen.getByTestId("drep-row"));
    expect(mockOnClick).toHaveBeenCalledWith(mockDRep);
  });

  it("opens the explorer URL when external link is clicked", () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    jest.mocked(getDefaultExplorerView).mockReturnValue("explorerView" as never);
    jest.mocked(getDRepExplorer).mockReturnValue("https://explorer.com/drep123");

    render(<DRepRow currency={mockCurrency} DRep={mockDRep} onClick={mockOnClick} />);

    fireEvent.click(screen.getByTestId("external-link"));

    expect(getDefaultExplorerView).toHaveBeenCalledWith(mockCurrency);
    expect(getDRepExplorer).toHaveBeenCalledWith("explorerView", "drep123");
    expect(openURL).toHaveBeenCalledWith("https://explorer.com/drep123");
  });
});
