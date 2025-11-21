import type { ParsedUserMessage } from '../types/payload';
import { renderMarkdownToHtml } from './renderer';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildQuestionHtml = (messages: ParsedUserMessage[]): string => {
  if (messages.length === 0) {
    return '<p>（暂无提问内容）</p>';
  }
  return messages
    .map((message, index) => {
      const label = `内容 ${index + 1}`;
      if (message.kind === 'text') {
        const rendered = renderMarkdownToHtml(message.text);
        return `<section class="question-block"><header>✍️ ${label}</header>${rendered}</section>`;
      }
      const escaped = escapeHtml(message.url);
      return `<section class="question-block"><header>🖼️ ${label}</header><img src="${escaped}" alt="用户图片 ${
        index + 1
      }" loading="lazy" /></section>`;
    })
    .join('\n');
};
