export interface RawProxyPayload {
  model?: string;
  system?: string;
  render?: boolean | string;
  [key: string]: unknown;
}

export type ParsedUserMessage =
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string };

export type RenderMode = 'text' | 'inline-html' | 'hosted-page';
