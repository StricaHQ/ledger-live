import { useCardanoFamilyDReps } from "@ledgerhq/live-common/families/cardano/react";
import { DRep } from "@ledgerhq/coin-cardano/api/api-types";

import { TransactionStatus } from "@ledgerhq/live-common/generated/types";
import { Account } from "@ledgerhq/types-live";
import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import BigSpinner from "~/renderer/components/BigSpinner";
import Box from "~/renderer/components/Box";
import DRepSearchInput, { NoResultPlaceholder } from "~/renderer/components/DRep/DRepSearchInput";
import ScrollLoadingList from "../ScrollLoadingList";
import DRepRow from "./DRepRow";
import DRepListHeader from "~/renderer/components/DRep/DRepListHeader";
type Props = {
  account: Account;
  status: TransactionStatus;
  onChangeDRep: (a: DRep) => void;
  selectedDRepHex: string;
};

export function putUserDRepAtFirstPositionInDReps(DReps: DRep[], firstDRepHex: string): DRep[] {
  const index = DReps.findIndex(pool => pool.hex === firstDRepHex);
  if (index === -1) {
    return DReps;
  }

  const DRep = { ...DReps[index] };
  return [DRep, ...DReps.filter((_, i) => i !== index)];
}

const DRepField = ({ account, onChangeDRep, selectedDRepHex }: Props) => {
  const [userAndLedgerDReps, setUserAndLedgerDReps] = useState<Array<DRep>>([]);
  const [userAndLedgerDRepsLoading, setUserAndLedgerDRepsLoading] = useState(false);
  const { DReps, searchQuery, setSearchQuery, onScrollEndReached, isSearching, isPaginating } =
    useCardanoFamilyDReps(account.currency);

  useEffect(() => {
    setUserAndLedgerDRepsLoading(true);
    setUserAndLedgerDReps(putUserDRepAtFirstPositionInDReps(DReps, selectedDRepHex));
    setUserAndLedgerDRepsLoading(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DReps]);

  useEffect(() => {
    const selectedDRep =
      DReps.find((d: { hex: string }) => d.hex === selectedDRepHex) ||
      userAndLedgerDReps.find(DRep => DRep.hex === selectedDRepHex);

    if (selectedDRep) {
      if (DReps.some((d: { hex: string }) => d.hex === selectedDRepHex)) {
        onChangeDRep(selectedDRep);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDRepHex]);

  const onSearch = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(evt.target.value),
    [setSearchQuery],
  );
  const renderItem = (DRep: DRep, DRepIdx: number) => {
    return (
      <DRepRow
        currency={account.currency}
        key={DRepIdx + DRep.hex}
        DRep={DRep}
        active={selectedDRepHex === DRep.hex}
        onClick={onChangeDRep}
      />
    );
  };

  return (
    <>
      {<DRepSearchInput noMargin={true} search={searchQuery} onSearch={onSearch} />}
      <DRepsFieldContainer>
        <Box p={1} data-testid="DRep-list">
          {isSearching || userAndLedgerDRepsLoading || (!DReps.length && !searchQuery) ? (
            <Box flex={1} py={3} alignItems="center" justifyContent="center">
              <BigSpinner size={35} />
            </Box>
          ) : (
            <Box>
              {userAndLedgerDReps.length > 0 && <DRepListHeader />}

              <ScrollLoadingList
                data={[...userAndLedgerDReps]}
                style={{
                  flex: "1 0 256px",
                  marginBottom: 0,
                  paddingLeft: 0,
                }}
                renderItem={renderItem}
                noResultPlaceholder={
                  userAndLedgerDReps.length <= 0 &&
                  !isSearching && <NoResultPlaceholder search={searchQuery} />
                }
                fetchPoolsFromNextPage={onScrollEndReached}
                search={searchQuery}
                isPaginating={isPaginating}
              />
            </Box>
          )}
        </Box>
      </DRepsFieldContainer>
    </>
  );
};

const DRepsFieldContainer = styled(Box)`
  border: 1px solid ${p => p.theme.colors.neutral.c40};
  border-radius: 4px;
`;

export default DRepField;
