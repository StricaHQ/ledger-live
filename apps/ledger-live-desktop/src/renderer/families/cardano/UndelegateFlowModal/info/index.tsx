import React, { useCallback } from "react";
import {
  Trans,
  // useTranslation
} from "react-i18next";
import { useDispatch } from "react-redux";
import { openModal, closeModal } from "~/renderer/actions/modals";
import { CardanoAccount } from "@ledgerhq/live-common/families/cardano/types";

import Modal, { ModalBody } from "~/renderer/components/Modal";
import Box from "~/renderer/components/Box";
import Text from "~/renderer/components/Text";
import Button from "~/renderer/components/Button";

export type CardanoUndelegateSelfTxInfoModalProps = {
  account: CardanoAccount;
};

export default function CardanoUndelegateSelfTxInfoModal({
  account,
}: CardanoUndelegateSelfTxInfoModalProps) {
  // const { t } = useTranslation();
  const dispatch = useDispatch();
  const onNext = useCallback(() => {
    dispatch(closeModal("MODAL_UNDELIGATE_SELF_TX_INFO"));
    dispatch(
      openModal("MODAL_SEND", {
        account,
        recipient: account.freshAddress,
      }),
    );
  }, [account, dispatch]);

  return (
    <Modal
      name="MODAL_UNDELIGATE_SELF_TX_INFO"
      centered
      render={({ onClose }) => (
        <ModalBody
          title={<Trans i18nKey="cardano.unDelegation.selfTransactionFlow.title" />}
          onClose={onClose}
          render={() => (
            <Box mx={4}>
              <Box flow={1} alignItems="center">
                {/* <Box mb={4}>
                  <RewardImg />
                </Box> */}
                <Box mb={4}>
                  <Text
                    ff="Inter|SemiBold"
                    fontSize={13}
                    textAlign="left"
                    color="palette.text.shade80"
                    style={{
                      lineHeight: 1.57,
                    }}
                  >
                    <p>
                      <Trans i18nKey="cardano.unDelegation.selfTransactionFlow.steps.starter.description.0" />
                    </p>
                    <br />
                    <p>
                      <Trans i18nKey="cardano.unDelegation.selfTransactionFlow.steps.starter.description.1" />
                    </p>
                  </Text>
                </Box>
              </Box>
            </Box>
          )}
          renderFooter={() => (
            <Box horizontal>
              <Button ml={2} secondary onClick={onClose}>
                <Trans i18nKey="common.cancel" />
              </Button>
              <Button
                ml={2}
                primary
                onClick={onNext}
                data-testid="modal-continue-button"
                name="continue"
              >
                {<Trans i18nKey="common.continue" />}
              </Button>
            </Box>
          )}
        />
      )}
    />
  );
}

// const RewardImg = styled.img.attrs(() => ({
//   src: Rewards,
// }))`
//   width: 130px;
//   height: auto;
// `;
