import { getDefaultExplorerView, getDRepExplorer } from "@ledgerhq/live-common/explorers";
import { CryptoCurrency } from "@ledgerhq/types-cryptoassets";
import React, { useCallback } from "react";
import styled from "styled-components";
import DRepRow from "~/renderer/components/DRep/DRepRow";
import Check from "~/renderer/icons/Check";
import { openURL } from "~/renderer/linking";
import { DRep } from "@ledgerhq/live-common/families/cardano/DRep";
import { dayAndHourFormat, useDateFormatter } from "~/renderer/hooks/useDateFormatter";
import LedgerDRepIcon from "../LedgerDRepIcon";

type Props = {
  currency: CryptoCurrency;
  DRep: DRep;
  active?: boolean;
  onClick: (v: DRep) => void;
};

function CardanoDRepRow({ DRep, active, onClick, currency }: Props) {
  const explorerView = getDefaultExplorerView(currency);
  const formatDate = useDateFormatter(dayAndHourFormat);

  const onExternalLink = useCallback(
    (hex: string) => {
      const srURL = explorerView && getDRepExplorer(explorerView, hex);
      if (srURL) openURL(srURL);
    },
    [explorerView],
  );

  const lastActiveOn = (date: string) => formatDate(new Date(date));

  return (
    <StyledDRepRow
      onClick={() => onClick(DRep)}
      key={DRep.hex}
      DRep={{
        hex: DRep.hex,
      }}
      title={DRep.meta?.givenName || ""}
      subtitle={DRep.hex}
      lastActiveOn={lastActiveOn(DRep.active)}
      onExternalLink={onExternalLink}
      icon={<LedgerDRepIcon dRep={DRep} />}
      chosenMark={<ChosenMark active={active ?? true} />}
    ></StyledDRepRow>
  );
}

const StyledDRepRow = styled(DRepRow)`
  border-color: transparent;
  margin-bottom: 0;
`;

const ChosenMark = styled(Check).attrs<{
  active: boolean;
}>(p => ({
  color: p.active ? p.theme.colors.primary.c80 : "transparent",
  size: 14,
}))<{
  active?: boolean;
  size?: number;
}>``;

export default CardanoDRepRow;
