import React from "react";
import { View } from "react-native";
import { Divider, Box } from "@ledgerhq/native-ui";
import type { AccountLike } from "@ledgerhq/types-live";
import CardanoDelegations from "./Delegations";
import CardanoVoteDelegation from "./VoteDelegation";

export default function CardanoAccountBodyHeader({ account }: { account: AccountLike }) {
  return (
    <View>
      <CardanoDelegations account={account} />
      <Box my={6}>
        <Divider />
      </Box>
      <CardanoVoteDelegation account={account} />
    </View>
  );
}
