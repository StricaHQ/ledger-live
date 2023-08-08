import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Account, AccountLike } from "@ledgerhq/types-live";
import { openModal, closeModal } from "~/renderer/actions/modals";
import EarnRewardsInfoModal from "~/renderer/components/EarnRewardsInfoModal";
import { urls } from "~/config/urls";
import { openURL } from "~/renderer/linking";
import LinkWithExternalIcon from "~/renderer/components/LinkWithExternalIcon";

type Props = {
  name: string;
  account: AccountLike;
  parentAccount: Account | undefined | null;
};

export default function CardanoEarnRewardsInfoModal({ name, account, parentAccount }: Props) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const onNext = useCallback(() => {
    dispatch(closeModal(name));
    dispatch(
      openModal("MODAL_CARDANO_DELEGATE", {
        parentAccount,
        account,
      }),
    );
  }, [parentAccount, account, dispatch, name]);
  const onLearnMore = useCallback(() => {
    openURL(urls.cardanoStakingRewards);
  }, []);
  return (
    <EarnRewardsInfoModal
      name={name}
      onNext={onNext}
      description={t("cardano.delegation.flow.steps.starter.description")}
      bullets={[
        t("cardano.delegation.flow.steps.starter.bullet.0"),
        t("cardano.delegation.flow.steps.starter.bullet.1"),
        t("cardano.delegation.flow.steps.starter.bullet.2"),
      ]}
      footerLeft={<LinkWithExternalIcon label={t("delegation.howItWorks")} onClick={onLearnMore} />}
      additional={null}
    />
  );
}
