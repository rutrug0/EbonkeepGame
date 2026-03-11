import type { FormEvent, RefObject } from "react";

import type { ChatMessage } from "./chat";
import type { ChatChannel } from "./navigation";
import { formatChatTime } from "./chat";
import { CHAT_CHANNEL_LABEL_KEYS, formatChatChannelLabel } from "./navigation";
import i18n from "../i18n";

export type ChatPanelProps = {
  activeChatChannel: ChatChannel;
  activeChatMessages: ChatMessage[];
  chatDraft: string;
  chatMessagesScrollRef: RefObject<HTMLDivElement | null>;
  onChannelChange: (channel: ChatChannel) => void;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChatPanel(props: ChatPanelProps) {
  return (
    <section className="contentShell statsViewportShell">
      <section className="contentStack statsViewportStack chatPanelStack">
        <article className="contentCard chatPanelTabsCard">
          <div className="chatPanelHeaderRow">
            <div className="chatChannelTabs" role="tablist" aria-label={i18n.t("chat.channels")}>
              {Object.keys(CHAT_CHANNEL_LABEL_KEYS).map((channel) => (
                <button
                  key={channel}
                  className={`profileSwitchButton${props.activeChatChannel === channel ? " active" : ""}`}
                  onClick={() => props.onChannelChange(channel as ChatChannel)}
                  role="tab"
                  aria-selected={props.activeChatChannel === channel}
                >
                  {formatChatChannelLabel(channel as ChatChannel)}
                </button>
              ))}
            </div>
            <button className="chatOverlayCloseButton" onClick={props.onClose} aria-label={i18n.t("chat.close")}>
              x
            </button>
          </div>
        </article>

        <article className="contentCard statsViewportBody sidePanelBodyCard chatMessagesCard">
          <div className="chatMessagesScroll" ref={props.chatMessagesScrollRef}>
            {props.activeChatMessages.length > 0 ? (
              <ul className="chatMessageList">
                {props.activeChatMessages.map((message) => (
                  <li key={message.id} className="chatMessageItem">
                    <p className="chatMessageMeta">
                      <strong>{message.sender}</strong>
                      <span>{formatChatTime(message.sentAtMs)}</span>
                    </p>
                    <p className="chatMessageText">{message.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="chatEmptyState">{i18n.t("chat.empty")}</p>
            )}
          </div>

          <form className="chatComposer" onSubmit={props.onSubmit}>
            <input
              type="text"
              value={props.chatDraft}
              onChange={(event) => props.onDraftChange(event.currentTarget.value)}
              placeholder={i18n.t("chat.messagePlaceholder", {
                channel: formatChatChannelLabel(props.activeChatChannel)
              })}
              maxLength={180}
            />
            <button type="submit" disabled={props.chatDraft.trim().length === 0}>
              {i18n.t("chat.send")}
            </button>
          </form>
        </article>
      </section>
    </section>
  );
}
