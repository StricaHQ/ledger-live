import MODAL_CARDANO_DELEGATE, { DelegationModalProps } from "./DelegationFlowModal";
import MODAL_CARDANO_VOTE_DELEGATION, { VoteDelegationModalProps } from "./VoteDelegationFlowModal";
import MODAL_CARDANO_UNDELEGATE, { UnDelegationModalProps } from "./UndelegateFlowModal";
import MODAL_CARDANO_REWARDS_INFO, {
  CardanoEarnRewardsInfoModalProps,
} from "./DelegationFlowModal/Info";

import MODAL_CARDANO_VOTE_DELEGATION_INFO, {
  VoteDelegationInfoModalProps,
} from "./VoteDelegationFlowModal/Info";

export type ModalsData = {
  MODAL_CARDANO_DELEGATE: DelegationModalProps;
  MODAL_CARDANO_UNDELEGATE: UnDelegationModalProps;
  MODAL_CARDANO_REWARDS_INFO: CardanoEarnRewardsInfoModalProps;
  MODAL_CARDANO_VOTE_DELEGATION: VoteDelegationModalProps;
  MODAL_CARDANO_VOTE_DELEGATION_INFO: VoteDelegationInfoModalProps;
};

export default {
  MODAL_CARDANO_DELEGATE,
  MODAL_CARDANO_UNDELEGATE,
  MODAL_CARDANO_REWARDS_INFO,
  MODAL_CARDANO_VOTE_DELEGATION,
  MODAL_CARDANO_VOTE_DELEGATION_INFO,
};
