import { timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { UserMessageAuthor } from "@getpaseo/protocol/user-message-author";
import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
import type { SessionOutboundMessage } from "@getpaseo/protocol/messages";

export function readProxyUser(
  headers: IncomingHttpHeaders,
  proxySecret: string | undefined,
): UserMessageAuthor | undefined {
  const suppliedSecret = headers["x-paseo-proxy-secret"];
  const username = headers["x-paseo-user"];
  if (!proxySecret || typeof suppliedSecret !== "string" || typeof username !== "string") {
    return undefined;
  }
  const expected = Buffer.from(proxySecret);
  const supplied = Buffer.from(suppliedSecret);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return undefined;
  if (!/^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/.test(username)) return undefined;
  return { username };
}

export function userAuthorWithAvatar(
  author: UserMessageAuthor | undefined,
  template: string | undefined,
): UserMessageAuthor | undefined {
  if (!author || !template) return author;
  return {
    ...author,
    avatarUrl: template.replaceAll("{username}", encodeURIComponent(author.username)),
  };
}

function withAvatar(item: AgentTimelineItem, template: string): AgentTimelineItem {
  if (item.type !== "user_message" || !item.author) return item;
  return { ...item, author: userAuthorWithAvatar(item.author, template) };
}

// Resolve URLs on delivery so changing the image host does not rewrite saved history.
export function withUserAvatars(
  message: SessionOutboundMessage,
  template: string | undefined,
): SessionOutboundMessage {
  if (!template) return message;
  if (message.type === "agent_stream" && message.payload.event.type === "timeline") {
    const event = message.payload.event;
    const item = withAvatar(event.item, template);
    if (item === event.item) return message;
    return { ...message, payload: { ...message.payload, event: { ...event, item } } };
  }
  if (message.type === "fetch_agent_timeline_response") {
    return {
      ...message,
      payload: {
        ...message.payload,
        entries: message.payload.entries.map((entry) => ({
          ...entry,
          item: withAvatar(entry.item, template),
        })),
      },
    };
  }
  return message;
}
