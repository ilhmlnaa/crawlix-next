import crypto from "node:crypto";
import { CrawlixWebhookVerificationError } from "./errors.js";
import type {
  VerifyWebhookSignatureInput,
  WebhookEventPayload,
} from "./types.js";

function toRawBodyString(rawBody: string | Buffer): string {
  return typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
}

export function createWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string | Buffer,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${toRawBodyString(rawBody)}`)
    .digest("hex");
}

export function verifyWebhookSignature(
  input: VerifyWebhookSignatureInput,
): boolean {
  const expected = createWebhookSignature(
    input.secret,
    input.timestamp,
    input.rawBody,
  );

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(input.signature, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function assertWebhookSignature(
  input: VerifyWebhookSignatureInput,
): void {
  if (!verifyWebhookSignature(input)) {
    throw new CrawlixWebhookVerificationError();
  }
}

export function parseWebhookEvent(rawBody: string | Buffer): WebhookEventPayload {
  return JSON.parse(toRawBodyString(rawBody)) as WebhookEventPayload;
}

export function createWebhookHeadersVerifier(secret: string) {
  return (headers: Headers | Record<string, string>, rawBody: string | Buffer) => {
    const getHeader = (name: string) => {
      if (headers instanceof Headers) {
        return headers.get(name);
      }

      const entry = Object.entries(headers).find(
        ([key]) => key.toLowerCase() === name.toLowerCase(),
      );
      return entry?.[1] ?? null;
    };

    const timestamp = getHeader("x-crawlix-timestamp");
    const signature = getHeader("x-crawlix-signature");

    if (!timestamp || !signature) {
      return false;
    }

    return verifyWebhookSignature({
      secret,
      timestamp,
      rawBody,
      signature,
    });
  };
}
