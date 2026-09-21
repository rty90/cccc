import type { ReactNode } from "react";

import { classNames } from "../../utils/classNames";
import { Surface } from "../ui/surface";

interface MessageBubbleSurfaceProps {
  children: ReactNode;
  isUserMessage: boolean;
  isStreaming: boolean;
  motionClass: string;
  isHighlighted: boolean;
  /** Agent message without a card: flat text, the row draws the hairline. */
  flat?: boolean;
}

function sharedClasses({
  isStreaming,
  motionClass,
  isHighlighted,
  flat = false,
}: Omit<MessageBubbleSurfaceProps, "children" | "isUserMessage">): string {
  return classNames(
    "inline-flex max-w-full min-w-0 flex-col text-sm leading-relaxed",
    // One padding only: with both sets present the card padding won and flat text stayed indented.
    flat ? "px-0.5 py-0" : "px-4 py-3",
    "transition-[opacity,transform,box-shadow,background-color,border-color] duration-200 ease-out",
    isStreaming ? "translate-y-0 opacity-95" : "translate-y-0 opacity-100",
    motionClass,
    isHighlighted ? "outline outline-2 outline-[var(--glass-accent-border)] outline-offset-2" : "",
  );
}

export function MessageBubbleSurface({
  children,
  isUserMessage,
  isStreaming,
  motionClass,
  isHighlighted,
  flat = false,
}: MessageBubbleSurfaceProps) {
  const flatAgent = flat && !isUserMessage;
  const className = sharedClasses({ isStreaming, motionClass, isHighlighted, flat: flatAgent });

  if (flatAgent) {
    return (
      <div className={classNames(className, "w-full text-[var(--color-text-primary)]")}>
        {children}
      </div>
    );
  }

  if (isUserMessage) {
    return (
      <div
        className={classNames(
          className,
          "glass-bubble w-auto min-w-[min(18rem,70vw)] rounded-[22px] rounded-tr-md",
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <Surface
      variant="subtle"
      padding="none"
      radius="lg"
      className={classNames(
        className,
        "w-full text-[var(--color-text-primary)] shadow-[var(--glass-bubble-shadow)]",
      )}
    >
      {children}
    </Surface>
  );
}
