import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { MessageBubbleSurface } from "./MessageBubbleSurface";
import { MessageFooter, MessageMetadataHeader } from "./MessageBubbleChrome";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function renderSurface(isUserMessage: boolean): string {
  return renderToStaticMarkup(
    <MessageBubbleSurface
      isUserMessage={isUserMessage}
      isStreaming={false}
      motionClass=""
      isHighlighted={false}
    >
      <p>Long product content remains inside the responsive message surface.</p>
    </MessageBubbleSurface>,
  );
}

describe("MessageBubbleSurface", () => {
  it("uses a neutral product surface for assistant messages", () => {
    const markup = renderSurface(false);

    expect(markup).toContain("max-w-full min-w-0");
    expect(markup).toContain("rounded-2xl");
    expect(markup).toContain("border-[var(--glass-border-subtle)]");
    expect(markup).toContain("shadow-[var(--glass-bubble-shadow)]");
    expect(markup).not.toContain("border-l-4");
    expect(markup).not.toMatch(/border-l-(?:sky|indigo|violet|fuchsia|cyan|teal|emerald|amber)/);
  });

  it("keeps the compact user bubble treatment", () => {
    const markup = renderSurface(true);

    expect(markup).toContain("glass-bubble");
    expect(markup).toContain("rounded-tr-md");
    expect(markup).toContain("min-w-[min(18rem,70vw)]");
  });
});

describe("MessageMetadataHeader", () => {
  it("shows the tags next to the time and the agent's own colour on the name", () => {
    const markup = renderToStaticMarkup(
      <MessageMetadataHeader
        isUserMessage={false}
        isDark={false}
        senderAccentColor="oklch(0.56 0.15 40)"
        senderMonogram="Cl"
        senderDisplayName="Claude"
        messageTimestamp="15:02"
        fullMessageTimestamp="2026-09-15 15:02"
        tags={<span title="mailMessageHint">modeMail</span>}
      />,
    );

    expect(markup).toContain("mailMessageHint");
    expect(markup).toContain("modeMail");
    expect(markup).toContain("color:oklch(0.56 0.15 40)");
    expect(markup).toContain("Claude");
  });

  it("labels your own messages with the time and the recipients instead of a name", () => {
    const markup = renderToStaticMarkup(
      <MessageMetadataHeader
        isUserMessage={true}
        isDark={false}
        senderDisplayName="You"
        messageTimestamp="14:55"
        fullMessageTimestamp="2026-09-15 14:55"
        userSuffix="Gemini"
      />,
    );

    expect(markup).toContain("14:55");
    expect(markup).toContain("Gemini");
    expect(markup).not.toContain("You");
  });
});

describe("MessageFooter", () => {
  it("no longer duplicates the mail tag that the header carries", () => {
    const markup = renderToStaticMarkup(
      <MessageFooter
        readOnly={false}
        obligationSummary={null}
        visibleReadStatusEntries={[]}
        readPreviewEntries={[]}
        readPreviewOverflow={0}
        displayNameMap={new Map()}
        isDark={false}
        isMail={true}
        replyRequested={false}
        copiedMessageText={false}
        copyableMessageText=""
        onCopyMessageText={() => undefined}
        onShowRecipients={() => undefined}
        onReply={() => undefined}
        canReply={false}
        event={{ id: "event-1", kind: "chat.message", by: "user", data: {} }}
      />,
    );

    expect(markup).not.toContain("modeMail");
  });
});
