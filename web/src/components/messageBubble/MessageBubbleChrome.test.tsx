import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { MessageFooter, MessageMetadataHeader } from "./MessageBubbleChrome";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

// Knots message rows: Mail and "reply requested" are identified in the header, next to the time, so the footer no
// longer repeats them.
describe("MessageMetadataHeader", () => {
  it("keeps Mail visibly identified on each message row, next to the time, with the agent's colour on the name", () => {
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
  it("does not repeat the mail tag that the header carries", () => {
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
