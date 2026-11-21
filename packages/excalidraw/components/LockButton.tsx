import clsx from "clsx";

import { getBindingLabels, joinLabels } from "../actions/shortcuts";

import { useKeymap } from "./App";
import { IconButton } from "./IconButton";
import { LockedIcon, UnlockedIcon } from "./icons";

type LockButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
  disabled?: boolean;
};

export const LockButton = (props: LockButtonProps) => {
  const keymap = useKeymap();
  const shortcut = joinLabels(getBindingLabels("editor:toolLock", keymap));

  return (
    <IconButton
      className={clsx("ToolIcon__lock", { "is-mobile": props.isMobile })}
      type="toggle"
      icon={props.checked ? LockedIcon : UnlockedIcon}
      checked={props.checked}
      disabled={props.disabled}
      title={shortcut ? `${props.title} — ${shortcut}` : `${props.title}`}
      aria-label={`${props.title}`}
      data-testid="toolbar-lock"
      onSelect={() => props.onChange?.()}
    />
  );
};
