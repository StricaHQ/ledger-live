import React, { useCallback, memo } from "react";

import styled, { css } from "styled-components";

import Box from "~/renderer/components/Box";
import Text from "~/renderer/components/Text";
import ExternalLink from "~/renderer/icons/ExternalLink";

export const IconContainer = styled.div<{
  isSR?: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: ${p => (p.isSR ? p.theme.colors.primary.c10 : p.theme.colors.neutral.c40)};
  color: ${p => (p.isSR ? p.theme.colors.primary.c80 : p.theme.colors.neutral.c70)};
`;

const NameContainer = styled(Box).attrs(() => ({
  px: 2,
  horizontal: true,
  alignItems: "center",
}))`
  display: flex;
  justify-content: flex-start;
  width: 60%;
  ${IconContainer} {
    background-color: rgba(0, 0, 0, 0);
    color: ${p => p.theme.colors.primary.c80};
    opacity: 0;
  }
  &:hover {
    color: ${p => p.theme.colors.primary.c80};
  }
  &:hover > ${IconContainer} {
    opacity: 1;
  }
`;

const Title = styled(Box).attrs(() => ({
  horizontal: true,
  alignItems: "center",
  py: 1,
}))`
  width: min-content;
  max-width: 95%;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: ${p => p.theme.colors.neutral.c100};
  ${Text} {
    flex: 0 1 auto;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const SubTitle = styled(Box).attrs(() => ({
  horizontal: true,
  alignItems: "center",
}))`
  font-size: 12px;
  font-weight: 500;
  color: ${p => p.theme.colors.neutral.c80};
  &:hover {
    color: ${p => p.theme.colors.primary.c80};
  }
  width: min-content;
  max-width: 95%;
  ${Text} {
    flex: 0 1 auto;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const DateAndTimeContainer = styled(Box)`
  width: 30%;
  font-size: 12px;
`;
const SelectedCheckContainer = styled(Box).attrs(() => ({
  mx: 2,
  justifyContent: "center",
}))`
  width: 5%;
  align-self: center;
`;

const Row = styled(Box).attrs(() => ({
  horizontal: true,
  flex: "0 0 70px",
  mb: 2,
  alignItems: "center",
  justifyContent: "flex-start",
  p: 2,
}))<{
  disabled?: boolean;
}>`
  border-radius: 4px;
  border: 1px solid transparent;
  position: relative;
  overflow: visible;
  cursor: pointer;

  ${p =>
    p.onClick
      ? css`
          &:hover {
            border-color: ${p.theme.colors.primary.c80};
          }
          ${IconContainer} {
            opacity: 1;
            color: inherit;
          }
        `
      : ""}
`;

export type DRepRowProps = {
  DRep: {
    hex: string;
  };

  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  lastActiveOn?: React.ReactNode;
  chosenMark: React.ReactNode;
  disabled?: boolean;

  onClick?: (a: DRepRowProps["DRep"]) => void;
  onExternalLink: (address: string) => void;
  style?: React.CSSProperties;
  className?: string;
};
const DRepRow = ({
  DRep,

  icon,
  title,
  subtitle,
  lastActiveOn,
  chosenMark,
  disabled,

  onExternalLink,
  onClick = () => null,
  style,
  className,
}: DRepRowProps) => {
  const onTitleClick: React.MouseEventHandler<HTMLDivElement> = useCallback(
    e => {
      e.stopPropagation();
      onExternalLink(DRep.hex);
    },
    [DRep, onExternalLink],
  );

  const onRowClick = useCallback(() => {
    onClick(DRep);
  }, [onClick, DRep]);

  return (
    <Row
      className={className}
      style={style}
      disabled={disabled}
      onClick={onRowClick}
      data-testid="modal-provider-row"
    >
      {icon}
      <NameContainer>
        <Box width={"100%"}>
          <Title>
            <Text data-testid="modal-provider-title">{title}</Text>
          </Title>

          <SubTitle onClick={onTitleClick}>
            <Text>{subtitle}</Text>
            <IconContainer>
              <ExternalLink size={16} />
            </IconContainer>
          </SubTitle>
        </Box>
      </NameContainer>
      <DateAndTimeContainer>
        <Text>{lastActiveOn}</Text>
      </DateAndTimeContainer>
      <SelectedCheckContainer>{chosenMark}</SelectedCheckContainer>
    </Row>
  );
};
export default memo<DRepRowProps>(DRepRow);
