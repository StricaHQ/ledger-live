import { DRep } from "@ledgerhq/live-common/families/cardano/DRep";
import React from "react";
import { IconContainer } from "~/renderer/components/Delegation/ValidatorRow";
import FirstLetterIcon from "~/renderer/components/FirstLetterIcon";

const CardanoDRepIcon = ({ dRep }: { dRep: DRep }) => {
  return (
    <IconContainer isSR>
      <FirstLetterIcon label={dRep.meta?.givenName || dRep.hex} />
    </IconContainer>
  );
};

export default CardanoDRepIcon;
