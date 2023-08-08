import React, { PureComponent } from "react";
import Modal from "~/renderer/components/Modal";
import Body from "./Body";
import { StepId } from "./types";
import { CardanoAccount } from "@ledgerhq/live-common/families/cardano/types";

type State = {
  stepId: StepId;
};
const INITIAL_STATE: { stepId: StepId } = {
  stepId: "validator",
};

export type DelegationModalProps = {
  account: CardanoAccount;
  parentAccount: CardanoAccount | undefined | null;
};

class DelegationModal extends PureComponent<
  {
    name: string;
  },
  State
> {
  state = INITIAL_STATE;
  handleReset = () => {
    return this.setState({
      ...INITIAL_STATE,
    });
  };

  handleStepChange = (stepId: StepId) =>
    this.setState({
      stepId,
    });

  render() {
    const { stepId } = this.state;
    const { name } = this.props;
    const isModalLocked = ["connectDevice", "confirmation"].includes(stepId);
    return (
      <Modal
        name={name}
        centered
        refocusWhenChange={stepId}
        onHide={this.handleReset}
        preventBackdropClick={isModalLocked}
        width={550}
        render={({ onClose, data }) => (
          <Body
            stepId={stepId}
            name={name}
            onClose={onClose}
            onChangeStepId={this.handleStepChange}
            params={data || {}}
          />
        )}
      />
    );
  }
}
export default DelegationModal;
