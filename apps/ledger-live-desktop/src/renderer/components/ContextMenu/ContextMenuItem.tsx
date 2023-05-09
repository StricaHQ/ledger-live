import React, { PureComponent } from "react";
import invariant from "invariant";
import { withContextMenuContext, ContextMenuItemType, ContextType } from "./ContextMenuWrapper";
import { track } from "~/renderer/analytics/segment";
const DISABLE_CONTEXT_MENU = Boolean(process.env.DISABLE_CONTEXT_MENU);

type InnerProps = {
  children?: React.ReactNode;
  leftClick?: boolean;
  items: ContextMenuItemType[];
  event?: string;
  eventProperties?: Record<string, unknown>;
};

type Props = InnerProps & {
  context: ContextType;
};

type State = {
  active: boolean;
};

class ContextMenuItem extends PureComponent<Props, State> {
  componentDidMount() {
    const { items, leftClick } = this.props;
    invariant(items, "Don't wrap with ContextMenuWrapper without providing items");
    if (this.ref) {
      if (leftClick) {
        this.ref.addEventListener("click", this.showContextMenu);
      } else if (!DISABLE_CONTEXT_MENU) {
        this.ref.addEventListener("contextmenu", this.showContextMenu);
      }
    }
  }

  componentWillUnmount() {
    const { leftClick } = this.props;
    if (this.ref) {
      if (leftClick) {
        this.ref.removeEventListener("click", this.showContextMenu);
      } else if (!DISABLE_CONTEXT_MENU) {
        this.ref.removeEventListener("contextmenu", this.showContextMenu);
      }
    }
  }

  showContextMenu = (e: MouseEvent) => {
    if (this.props.event) {
      track(this.props.event, this.props.eventProperties);
    }
    this.props.context.showContextMenu(e, this.props.items);
    e.preventDefault();
    e.stopPropagation();
  };

  ref: HTMLDivElement | null = null;
  render() {
    const { children } = this.props;
    return <div ref={c => (this.ref = c)}>{children}</div>;
  }
}

const Wrapped = withContextMenuContext<InnerProps>(ContextMenuItem);

export default Wrapped;
