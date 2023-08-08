import { CardanoAccount } from "@ledgerhq/live-common/families/cardano/types";
import invariant from "invariant";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { openModal } from "~/renderer/actions/modals";
import IconCoins from "~/renderer/icons/Coins";

type Props = {
  account: CardanoAccount;
};

const AccountHeaderActions = ({ account }: Props) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { cardanoResources } = account as CardanoAccount;
  invariant(cardanoResources, "cardano account expected");
  const disableStakeButton =
    (cardanoResources.delegation && !!cardanoResources.delegation.poolId) ||
    account.balance.isZero();
  const disabledLabel =
    cardanoResources.delegation && cardanoResources.delegation.poolId
      ? t("cardano.delegation.assetsAlreadyStaked")
      : account.balance.isZero()
      ? t("cardano.delegation.addFundsToStake")
      : "";
  const onClick = useCallback(() => {
    dispatch(
      openModal("MODAL_CARDANO_REWARDS_INFO", {
        account,
        name: "MODAL_CARDANO_REWARDS_INFO",
      }),
    );
  }, [dispatch, account]);
  if (account.type !== "Account") return null;
  return [
    {
      key: "Stake",
      onClick: onClick,
      icon: IconCoins,
      disabled: disableStakeButton,
      label: t("account.stake"),
      tooltip: disabledLabel,
    },
  ];
};

export default AccountHeaderActions;
