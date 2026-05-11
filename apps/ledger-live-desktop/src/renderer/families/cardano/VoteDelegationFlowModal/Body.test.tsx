import React from "react";
import { render, screen, fireEvent } from "tests/testSetup";
import Body from "./Body";
import { Operation } from "@ledgerhq/types-live";
import { CardanoAccount } from "@ledgerhq/live-common/families/cardano/types";
import { StepId } from "./types";
import useBridgeTransaction from "@ledgerhq/live-common/bridge/useBridgeTransaction";

jest.mock("@ledgerhq/live-common/bridge/useBridgeTransaction", () => ({
  __esModule: true,
  default: jest.fn(cb => {
    if (typeof cb === "function") cb();
    return {
      transaction: { id: "tx-id" },
      setTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      account: { id: "acc-id" },
      status: { errors: {} },
      bridgeError: null,
      bridgePending: false,
    };
  }),
}));

jest.mock("@ledgerhq/live-common/bridge/index", () => ({
  getAccountBridge: () => ({
    createTransaction: jest.fn().mockReturnValue({}),
    updateTransaction: jest.fn().mockReturnValue({}),
  }),
}));

jest.mock("~/renderer/components/Stepper", () => ({
  __esModule: true,
  default: ({
    title,
    stepId,
    onOperationBroadcasted,
    onTransactionError,
    onRetry,
    onClose,
  }: {
    title: React.ReactNode;
    stepId: string;
    onOperationBroadcasted: (op: Operation) => void;
    onTransactionError: (error: Error) => void;
    onRetry: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="stepper">
      <span>{title}</span>
      <span>{stepId}</span>
      <button
        data-testid="broadcast-btn"
        onClick={() =>
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          onOperationBroadcasted({ id: "op-id" } as Operation)
        }
      >
        Broadcast
      </button>
      <button data-testid="error-btn" onClick={() => onTransactionError(new Error("test error"))}>
        Error
      </button>
      <button data-testid="retry-btn" onClick={onRetry}>
        Retry
      </button>
      <button data-testid="close-btn" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

describe("VoteDelegationFlowModal Body", () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const mockAccount = {
    id: "acc-id",
    cardanoResources: {},
    currency: { id: "cardano" },
  } as CardanoAccount;

  const mockParams = {
    account: mockAccount,
    option: "DRep" as const,
  };

  const mockProps = {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    stepId: "DRep" as StepId,
    onClose: jest.fn(),
    onChangeStepId: jest.fn(),
    params: mockParams,
    name: "modal-name",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with default step", () => {
    render(<Body {...mockProps} />);

    expect(screen.getByTestId("stepper")).toBeInTheDocument();
    expect(screen.getByTestId("stepper")).toHaveTextContent(/Vote Delegation/i);
    expect(screen.getByText("DRep")).toBeInTheDocument();
  });

  it("automatically redirects to summary if option is abstain", () => {
    const onChangeStepIdMock = jest.fn();
    render(
      <Body
        {...mockProps}
        onChangeStepId={onChangeStepIdMock}
        params={{ ...mockParams, option: "abstain" }}
      />,
    );

    expect(onChangeStepIdMock).toHaveBeenCalledWith("summary");
  });

  it("handles operation broadcast", () => {
    render(<Body {...mockProps} />);
    fireEvent.click(screen.getByTestId("broadcast-btn"));
  });

  it("renders with transaction error", () => {
    render(<Body {...mockProps} />);
    fireEvent.click(screen.getByTestId("error-btn"));
  });

  it("handles retry", () => {
    render(<Body {...mockProps} />);
    fireEvent.click(screen.getByTestId("retry-btn"));
    expect(mockProps.onChangeStepId).toHaveBeenCalledWith("DRep");
  });

  it("handles close", () => {
    render(<Body {...mockProps} />);
    fireEvent.click(screen.getByTestId("close-btn"));
  });

  it("sets error steps when errors are present", () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (useBridgeTransaction as jest.Mock).mockReturnValueOnce({
      transaction: { id: "tx-id" },
      setTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      account: mockAccount,
      status: { errors: {} },
      bridgeError: new Error("bridge error"),
      bridgePending: false,
    });

    render(<Body {...mockProps} />);
  });
});
