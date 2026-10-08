import { z } from 'zod';
import { publicDtoSchema } from '../../domain/event/public-projection';
import type { PublicStageDto } from '../../domain/projection/public-stage';

const eventIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{8,128}$/);
const helloSchema = z.strictObject({
  protocolVersion: z.literal(1), kind: z.literal('HELLO'),
  eventId: eventIdSchema, viewerId: z.string().min(1).max(128),
  requestId: z.string().min(1).max(128),
});
const ackSchema = z.strictObject({
  protocolVersion: z.literal(1), kind: z.literal('ACK'),
  eventId: eventIdSchema, viewerId: z.string().min(1).max(128),
  hostEpoch: z.number().int().positive(), stageRevision: z.number().int().min(0),
});
const frameSchema = z.strictObject({
  protocolVersion: z.literal(1), kind: z.literal('FRAME'),
  eventId: eventIdSchema, frame: publicDtoSchema,
});
export const stageMessageSchema = z.discriminatedUnion('kind', [helloSchema, frameSchema, ackSchema]);
export type StageMessage = z.infer<typeof stageMessageSchema>;

export interface StagePort {
  send(message: StageMessage): void;
  subscribe(onMessage: (unknownMessage: unknown) => void): () => void;
  close(): void;
}

export function stageEventIdFromHash(hash: string): string | null {
  const match = /^#\/stage(?:\?(.+))?$/.exec(hash);
  if (!match) return null;
  const raw = new URLSearchParams(match[1] ?? '').get('event');
  return raw && eventIdSchema.safeParse(raw).success ? raw : null;
}
export function stageUrl(eventId: string): string {
  eventIdSchema.parse(eventId);
  return '#/stage?event=' + encodeURIComponent(eventId);
}
export function stageChannelName(eventId: string): string {
  eventIdSchema.parse(eventId);
  return 'ligoquiz.v2.public-stage.' + eventId;
}
export function checkedFrame(raw: unknown): PublicStageDto | null {
  const parsed = publicDtoSchema.safeParse(raw);
  return parsed.success ? (parsed.data as PublicStageDto) : null;
}

/** Each port owns exactly one BroadcastChannel; no polling from stage storage. */
export class BrowserStagePort implements StagePort {
  private readonly channel: BroadcastChannel;
  constructor(eventId: string) {
    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('BroadcastChannel is not supported by this browser');
    }
    this.channel = new BroadcastChannel(stageChannelName(eventId));
  }
  send(message: StageMessage): void {
    this.channel.postMessage(stageMessageSchema.parse(message));
  }
  subscribe(onMessage: (unknownMessage: unknown) => void): () => void {
    const listener = (event: MessageEvent<unknown>) => onMessage(event.data);
    this.channel.addEventListener('message', listener);
    return () => this.channel.removeEventListener('message', listener);
  }
  close(): void {
    this.channel.close();
  }
}
