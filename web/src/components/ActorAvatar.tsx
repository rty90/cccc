import { memo, useMemo, useState } from "react";
import { classNames } from "../utils/classNames";
import { withAuthToken } from "../services/api/base";
import { getRuntimeLogoSrc } from "../utils/runtimeLogos";
import { ClaudeLogo } from "./runtimeLogos/ClaudeLogo";
export type ActorAvatarProps = {
  avatarUrl?: string | null;
  previewUrl?: string | null;
  runtime?: string | null;
  title?: string | null;
  isUser?: boolean;
  isDark: boolean;
  accentRingClassName?: string | null;
  sizeClassName?: string;
  textClassName?: string;
  className?: string;
  /** Offline / disabled actor: greyed out. */
  dimmed?: boolean;
  /** Two-letter mark drawn in `accentColor` on its 16% tint instead of the runtime logo (see utils/agentColors). */
  monogram?: string | null;
  accentColor?: string | null;
};

export const ActorAvatar = memo(function ActorAvatar({
  avatarUrl,
  previewUrl,
  runtime,
  title,
  isUser = false,
  isDark,
  accentRingClassName,
  sizeClassName = "h-8 w-8",
  textClassName = "text-xs",
  className,
  dimmed = false,
  monogram,
  accentColor,
}: ActorAvatarProps) {
  const previewSrc = useMemo(() => {
    if (isUser) return null;
    const raw = String(previewUrl || "").trim();
    return raw || null;
  }, [previewUrl, isUser]);

  const customAvatarSrc = useMemo(() => {
    if (isUser) return null;
    const raw = String(avatarUrl || "").trim();
    if (!raw) return null;
    return raw.includes("token=") ? raw : withAuthToken(raw);
  }, [avatarUrl, isUser]);
  const [failedCustomAvatarSrc, setFailedCustomAvatarSrc] = useState<string | null>(null);
  const customAvatarFailed = !!customAvatarSrc && failedCustomAvatarSrc === customAvatarSrc;

  const usesInlineClaudeLogo =
    !isUser &&
    String(runtime || "")
      .trim()
      .toLowerCase() === "claude";
  const runtimeKey = String(runtime || "")
    .trim()
    .toLowerCase();
  const logoClassName =
    runtimeKey === "grok"
      ? "h-[68%] w-[68%] object-contain"
      : runtimeKey === "cline"
        ? "h-[72%] w-[72%] object-contain"
        : runtimeKey === "copilot"
          ? "h-[88%] w-[88%] object-contain"
          : "h-full w-full object-contain";

  const logoSrc = useMemo(() => {
    if (isUser || usesInlineClaudeLogo) return null;
    return getRuntimeLogoSrc(runtime);
  }, [isUser, runtime, usesInlineClaudeLogo]);

  const fallbackText = isUser ? "U" : (String(title || "").trim() || "?")[0].toUpperCase();
  const useMonogram =
    !isUser && !!monogram && !!accentColor && !previewSrc && (!customAvatarSrc || customAvatarFailed);

  return (
    <div
      className={classNames(
        "flex flex-shrink-0 items-center justify-center overflow-hidden font-bold",
        useMonogram ? "rounded-[9px]" : "rounded-full shadow-sm",
        sizeClassName,
        textClassName,
        useMonogram
          ? ""
          : isUser
            ? isDark
              ? "bg-[linear-gradient(135deg,#1f2937_0%,#111827_100%)] text-gray-200 border border-white/10"
              : "bg-[linear-gradient(135deg,rgb(245,245,245)_0%,rgb(232,234,236)_100%)] text-[rgb(35,36,37)] border border-black/6"
            : isDark
              ? "bg-[linear-gradient(135deg,var(--glass-tab-bg-hover)_0%,var(--glass-tab-bg-active)_100%)] text-[var(--color-text-secondary)] border border-[var(--glass-border-subtle)]"
              : "border border-gray-200 bg-white text-gray-700",
        !isUser && !useMonogram && accentRingClassName ? `ring-1 ring-inset ${accentRingClassName}` : "",
        dimmed ? "grayscale opacity-50" : "",
        className,
      )}
      style={
        useMonogram
          ? { background: `color-mix(in srgb, ${accentColor} 16%, transparent)`, color: accentColor ?? undefined }
          : undefined
      }
    >
      {useMonogram ? (
        <span className="tracking-[0.01em]">{monogram}</span>
      ) : previewSrc ? (
        <img src={previewSrc} alt="" className="h-full w-full object-contain" />
      ) : customAvatarSrc && !customAvatarFailed ? (
        <img
          src={customAvatarSrc}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailedCustomAvatarSrc(customAvatarSrc)}
        />
      ) : usesInlineClaudeLogo ? (
        <ClaudeLogo className="h-3/5 w-3/5" />
      ) : logoSrc ? (
        <span className="flex h-full w-full items-center justify-center bg-white">
          <img src={logoSrc} alt="" className={logoClassName} />
        </span>
      ) : (
        fallbackText
      )}
    </div>
  );
});
