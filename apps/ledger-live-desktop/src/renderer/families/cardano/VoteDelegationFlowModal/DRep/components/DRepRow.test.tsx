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

    fireEvent.click(screen.getByTestId("modal-provider-row"));
    expect(mockOnClick).toHaveBeenCalledWith(mockDRep);
  });

  it("opens the explorer URL when external link is clicked", () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    jest.mocked(getDefaultExplorerView).mockReturnValue("explorerView" as never);
    jest.mocked(getDRepExplorer).mockReturnValue("https://explorer.com/drep123");

    render(<DRepRow currency={mockCurrency} DRep={mockDRep} onClick={mockOnClick} />);

    fireEvent.click(screen.getByText("drep123"));

    expect(getDefaultExplorerView).toHaveBeenCalledWith(mockCurrency);
    expect(getDRepExplorer).toHaveBeenCalledWith("explorerView", "drep123");
    expect(openURL).toHaveBeenCalledWith("https://explorer.com/drep123");

    // Ensure that row click was not triggered due to stopPropagation
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("handles missing DRep meta name gracefully", () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const missingMetaDRep = {
      hex: "drep456",
      active: "2023-01-01T00:00:00.000Z",
    } as DRep;

    render(<DRepRow currency={mockCurrency} DRep={missingMetaDRep} onClick={mockOnClick} />);

    // The title element should exist but be empty
    const titleElement = screen.getByTestId("modal-provider-title");
    expect(titleElement).toHaveTextContent("");
    expect(screen.getByText("drep456")).toBeInTheDocument();
  });

  it("renders correctly without external link if explorer URL is not found", () => {
    jest.mocked(getDefaultExplorerView).mockReturnValue(undefined);

    render(<DRepRow currency={mockCurrency} DRep={mockDRep} onClick={mockOnClick} />);

    fireEvent.click(screen.getByText("drep123"));

    // openURL should not be called
    expect(openURL).not.toHaveBeenCalled();
  });

  it("renders correctly when active is false", () => {
    const { container } = render(
      <DRepRow currency={mockCurrency} DRep={mockDRep} onClick={mockOnClick} active={false} />,
    );

    // It should render, and ChosenMark's active prop should handle the false state.
    // Testing the actual color of a styled-component is tricky without full theme mocking,
    // so we verify it renders without crashing and the SVG is in the DOM.
    expect(screen.getByText("Test DRep")).toBeInTheDocument();

    // Check if the checkmark container exists (it should always be there but its color might change)
    // The inner path element of ChosenMark should still be there.
    const svgElements = container.querySelectorAll("svg");
    expect(svgElements.length).toBeGreaterThan(0);
  });
});
