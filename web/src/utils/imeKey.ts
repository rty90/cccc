import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * True while an input-method editor is composing (Chinese, Japanese, Korean): the Enter that confirms a candidate
 * must not count as "submit". `isComposing` is the standard signal; keyCode 229 is what some Chromium/IME
 * combinations report instead. The chat composer applies the same two checks.
 */
export function isComposingKeyEvent(event: ReactKeyboardEvent<Element>): boolean {
  const native = event.nativeEvent as KeyboardEvent | undefined;
  return Boolean(native?.isComposing) || native?.keyCode === 229 || event.keyCode === 229;
}
