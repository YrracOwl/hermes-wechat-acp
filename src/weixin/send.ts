/**
 * Send messages via WeChat iLink API.
 * Supports text, image, file, and video messages.
 */

import crypto from "node:crypto";
import { sendMessage } from "./api.js";
import { MessageType, MessageState, MessageItemType } from "./types.js";
import type { MessageItem } from "./types.js";
import type { UploadedFileInfo } from "./upload.js";

export interface WeixinSendOpts {
  baseUrl: string;
  token?: string;
  contextToken?: string;
  /** AI inference run ID for message trace correlation. */
  runId?: string;
}

// --- Text ---

export async function sendTextMessage(
  to: string,
  text: string,
  opts: WeixinSendOpts,
  clientId?: string,
  sendFn: typeof sendMessage = sendMessage,
): Promise<string> {
  if (!opts.contextToken) {
    console.warn("[sendTextMessage] contextToken missing — sending without context");
  }

  const id = clientId ?? `wechat-acp-${crypto.randomUUID()}`;
  await sendFn({
    baseUrl: opts.baseUrl,
    token: opts.token,
    body: {
      msg: {
        from_user_id: "",
        to_user_id: to,
        client_id: id,
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        context_token: opts.contextToken,
        item_list: [{ type: 1, text_item: { text } }],
      },
    },
  });
  return id;
}

/** Split text into segments of max length, respecting line breaks where possible. */
export function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      segments.push(remaining);
      break;
    }

    let breakAt = remaining.lastIndexOf("\n", maxLen);
    if (breakAt <= 0) breakAt = maxLen;

    segments.push(remaining.substring(0, breakAt));
    remaining = remaining.substring(breakAt).replace(/^\n/, "");
  }

  return segments;
}

// --- Media helpers ---

function generateClientId(): string {
  return `wechat-acp-${crypto.randomUUID()}`;
}

/**
 * Send one or more MessageItems (optionally preceded by a text caption) downstream.
 * Each item is sent as its own request so that item_list always has exactly one entry.
 */
async function sendMediaItems(params: {
  to: string;
  text: string;
  mediaItem: MessageItem;
  opts: WeixinSendOpts;
  label: string;
  sendFn?: typeof sendMessage;
}): Promise<{ messageId: string }> {
  const { to, text, mediaItem, opts, label } = params;
  const send = params.sendFn ?? sendMessage;

  if (!opts.contextToken) {
    console.warn(`[${label}] contextToken missing — sending without context`);
  }

  const items: MessageItem[] = [];
  if (text) {
    items.push({ type: MessageItemType.TEXT, text_item: { text } });
  }
  items.push(mediaItem);

  let lastClientId = "";
  for (const item of items) {
    lastClientId = generateClientId();
    await send({
      baseUrl: opts.baseUrl,
      token: opts.token,
      body: {
        msg: {
          from_user_id: "",
          to_user_id: to,
          client_id: lastClientId,
          message_type: MessageType.BOT,
          message_state: MessageState.FINISH,
          item_list: [item],
          context_token: opts.contextToken ?? undefined,
          run_id: opts.runId,
        },
      },
    });
  }

  return { messageId: lastClientId };
}

// --- Image ---

/**
 * Send an image message downstream using a previously uploaded file.
 * Optionally include a text caption as a separate TEXT item before the image.
 */
export async function sendImageMessage(
  params: {
    to: string;
    text: string;
    uploaded: UploadedFileInfo;
    opts: WeixinSendOpts;
  },
  sendFn?: typeof sendMessage,
): Promise<{ messageId: string }> {
  const { to, text, uploaded, opts } = params;

  const imageItem: MessageItem = {
    type: MessageItemType.IMAGE,
    image_item: {
      media: {
        encrypt_query_param: uploaded.downloadEncryptedQueryParam,
        aes_key: Buffer.from(uploaded.aeskey).toString("base64"),
        encrypt_type: 1,
      },
      mid_size: uploaded.fileSizeCiphertext,
    },
  };

  return sendMediaItems({ to, text, mediaItem: imageItem, opts, label: "sendImageMessage", sendFn });
}

// --- Video ---

/**
 * Send a video message downstream using a previously uploaded file.
 * Includes an optional text caption sent as a separate TEXT item first.
 */
export async function sendVideoMessage(
  params: {
    to: string;
    text: string;
    uploaded: UploadedFileInfo;
    opts: WeixinSendOpts;
  },
  sendFn?: typeof sendMessage,
): Promise<{ messageId: string }> {
  const { to, text, uploaded, opts } = params;

  const videoItem: MessageItem = {
    type: MessageItemType.VIDEO,
    video_item: {
      media: {
        encrypt_query_param: uploaded.downloadEncryptedQueryParam,
        aes_key: Buffer.from(uploaded.aeskey).toString("base64"),
        encrypt_type: 1,
      },
      video_size: uploaded.fileSizeCiphertext,
    },
  };

  return sendMediaItems({ to, text, mediaItem: videoItem, opts, label: "sendVideoMessage", sendFn });
}

// --- File attachment ---

/**
 * Send a file attachment downstream using a previously uploaded file.
 * FileItem: media (CDN ref), file_name, len (plaintext bytes as string).
 * Includes an optional text caption sent as a separate TEXT item first.
 */
export async function sendFileMessage(
  params: {
    to: string;
    text: string;
    fileName: string;
    uploaded: UploadedFileInfo;
    opts: WeixinSendOpts;
  },
  sendFn?: typeof sendMessage,
): Promise<{ messageId: string }> {
  const { to, text, fileName, uploaded, opts } = params;

  const fileItem: MessageItem = {
    type: MessageItemType.FILE,
    file_item: {
      media: {
        encrypt_query_param: uploaded.downloadEncryptedQueryParam,
        aes_key: Buffer.from(uploaded.aeskey).toString("base64"),
        encrypt_type: 1,
      },
      file_name: fileName,
      len: String(uploaded.fileSize),
    },
  };

  return sendMediaItems({ to, text, mediaItem: fileItem, opts, label: "sendFileMessage", sendFn });
}
