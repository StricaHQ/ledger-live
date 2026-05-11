import React from "react";
import Delegation from "./Delegation";
import VoteDelegation from "./voteDelegation";
import { AccountLike } from "@ledgerhq/types-live";

type Props = {
  account: AccountLike;
};

export default function AccountBodyHeader({ account }: Props) {
  return (
    <>
      <Delegation account={account} />
      <VoteDelegation account={account} />
    </>
  );
}
