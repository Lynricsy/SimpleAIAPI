import type { Request } from 'express';
import { nanoid } from 'nanoid';
import { savePageHtml, ensurePagesDirectory } from '../utils/pageStore';
import { buildPublicAssetUrl } from '../utils/urlBuilder';
import { getKatexStyleTag } from '../utils/katexStyle';
import { ensureShareMetadataDirectory, saveShareMetadata } from '../utils/shareMetadataStore';

interface PageOptions {
  model: string;
  shareLink?: string;
  questionHtml?: string;
  pageTitle?: string;
}

const buildHtmlDocument = (content: string, options: PageOptions): string => {
  const timestamp = new Date().toLocaleString();
  const questionSection = options.questionHtml
    ? `<section class="question-panel">
        <h2>🙋 提问记录</h2>
        ${options.questionHtml}
      </section>`
    : '';
  const shareSection = options.shareLink
    ? `<section class="share-panel">
        <p>📤 想把这份回答分享给同事吗？点击下方按钮复制专属链接：</p>
        <button id="copy-share" data-share-link="${options.shareLink}">复制分享链接</button>
        <p class="share-hint">如果复制失败，可以直接复制：<span class="share-link-text">${options.shareLink}</span></p>
      </section>`
    : '';
  const copyScript = options.shareLink
    ? `<script>
        (() => {
          const btn = document.getElementById('copy-share');
          if (!btn) return;
          btn.addEventListener('click', async () => {
            const link = btn.getAttribute('data-share-link');
            if (!link) return;
            try {
              await navigator.clipboard.writeText(link);
              btn.textContent = '已复制 ✅';
              setTimeout(() => {
                btn.textContent = '复制分享链接';
              }, 3000);
            } catch (error) {
              btn.textContent = '复制失败，请手动复制';
            }
          });
        })();
      </script>`
    : '';
  return `<!DOCTYPE html>
<html lang="zh-Hans">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.pageTitle ?? 'AI 回复预览'}</title>
    ${getKatexStyleTag()}
    <style>
      :root {
        color-scheme: light dark;
        --page-bg: linear-gradient(145deg, #f5f7fb, #dfe9f3);
        --card-bg: rgba(255, 255, 255, 0.95);
        --card-text: #1f2933;
        --meta-text: #64748b;
        --bubble-bg: linear-gradient(145deg, #ffffff, #f4f7ff);
        --bubble-border: rgba(99, 102, 241, 0.15);
        --bubble-text: #1f2937;
        --bubble-heading: #3730a3;
        --code-bg: #0f172a;
        --code-text: #e2e8f0;
        --inline-code-bg: rgba(15, 23, 42, 0.08);
        --table-border: rgba(15, 23, 42, 0.08);
        --katex-bg: rgba(99, 102, 241, 0.04);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --page-bg: radial-gradient(circle at top, #1f2933, #0f172a);
          --card-bg: rgba(15, 23, 42, 0.9);
          --card-text: #f1f5f9;
          --meta-text: #94a3b8;
          --bubble-bg: linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.85));
          --bubble-border: rgba(99, 102, 241, 0.3);
          --bubble-text: #e2e8f0;
          --bubble-heading: #c7d2fe;
          --code-bg: #0b1220;
          --code-text: #e2e8f0;
          --inline-code-bg: rgba(148, 163, 184, 0.25);
          --table-border: rgba(148, 163, 184, 0.3);
          --katex-bg: rgba(59, 130, 246, 0.08);
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: 'HarmonyOS Sans SC', 'Source Han Sans SC', 'Noto Sans SC', 'PingFang SC',
          'Microsoft YaHei', 'Noto Color Emoji', 'Twemoji Mozilla', 'Segoe UI Emoji', 'Helvetica Neue',
          Arial, sans-serif;
        background: var(--page-bg);
        min-height: 100vh;
        padding: 32px;
        display: flex;
        justify-content: center;
      }
      .card {
        width: min(820px, 96vw);
        background: var(--card-bg);
        border-radius: 18px;
        box-shadow: 0 10px 40px rgba(15, 23, 42, 0.15);
        padding: 32px 40px;
        color: var(--card-text);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 0.9rem;
        color: var(--meta-text);
        margin-bottom: 24px;
      }
      .bubble {
        position: relative;
        padding: 1.5rem;
        border-radius: 16px;
        background: var(--bubble-bg);
        border: 1px solid var(--bubble-border);
        font-size: 1.02rem;
        line-height: 1.8;
        color: var(--bubble-text);
      }
      .bubble::after {
        content: '';
        position: absolute;
        left: 32px;
        bottom: -18px;
        width: 24px;
        height: 24px;
        background: inherit;
        border: inherit;
        border-top: none;
        border-left: none;
        transform: rotate(45deg);
      }
      .bubble :is(h1, h2, h3, h4) {
        color: var(--bubble-heading);
        margin-top: 1.8rem;
      }
      .bubble pre {
        background: var(--code-bg);
        color: var(--code-text);
        padding: 1rem;
        border-radius: 12px;
        overflow-x: auto;
      }
      .bubble code {
        background: var(--inline-code-bg);
        padding: 0.1rem 0.4rem;
        border-radius: 6px;
      }
      .bubble img {
        max-width: 100%;
        border-radius: 14px;
        margin: 1.2rem 0;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.15);
      }
      .bubble table {
        width: 100%;
        border-collapse: collapse;
        margin: 1.5rem 0;
        font-size: 0.95rem;
      }
      .bubble table th,
      .bubble table td {
        border: 1px solid var(--table-border);
        padding: 0.7rem;
      }
      .bubble ul,
      .bubble ol {
        padding-left: 1.5rem;
      }
      .question-panel {
        border: 1px solid var(--table-border);
        border-radius: 14px;
        padding: 1.2rem 1.5rem;
        margin-bottom: 1.5rem;
        background: rgba(99, 102, 241, 0.06);
      }
      .question-panel h2 {
        margin-top: 0;
      }
      .question-block {
        border-radius: 12px;
        padding: 1rem;
        margin-top: 1rem;
        background: rgba(148, 163, 184, 0.1);
      }
      .question-block header {
        font-weight: 700;
        margin-bottom: 0.5rem;
      }
      .question-block img {
        max-width: 100%;
        border-radius: 12px;
        margin-top: 0.8rem;
      }
      .share-panel {
        margin-top: 1.5rem;
        padding: 1rem 1.2rem;
        border-radius: 14px;
        border: 1px dashed var(--bubble-border);
        background: rgba(99, 102, 241, 0.05);
      }
      .share-panel button {
        background: #6366f1;
        border: none;
        color: #fff;
        padding: 0.6rem 1.2rem;
        font-size: 1rem;
        border-radius: 10px;
        cursor: pointer;
      }
      .share-panel button:hover {
        opacity: 0.9;
      }
      .share-link-text {
        word-break: break-all;
        font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
      }
      .katex-display {
        overflow-x: auto;
        padding-bottom: 0.5rem;
        margin: 1rem 0;
        border-radius: 8px;
        background: var(--katex-bg);
      }
      @media (max-width: 640px) {
        body {
          padding: 16px;
        }
        .card {
          padding: 24px;
        }
        .bubble {
          font-size: 0.95rem;
          padding: 1.1rem;
        }
        .katex-display {
          font-size: 1.05rem;
          line-height: 1.4;
          overflow-x: auto;
        }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <section class="meta">
        <span>✨ 模型：${options.model}</span>
        <span>🕒 生成时间：${timestamp}</span>
      </section>
      ${questionSection}
      <article class="bubble">
        ${content}
      </article>
      ${shareSection}
    </main>
    ${copyScript}
  </body>
</html>`;
};

const imageSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;

const extractLocalImageFiles = (html: string): string[] => {
  const matches = new Set<string>();
  let execResult: RegExpExecArray | null;
  while ((execResult = imageSrcRegex.exec(html)) !== null) {
    const src = execResult[1];
    if (!src || !src.startsWith('/img/')) {
      continue;
    }
    const segments = src.split('/');
    const filename = segments[segments.length - 1];
    if (filename) {
      matches.add(filename);
    }
  }
  return Array.from(matches);
};

interface PublishOptions {
  model: string;
  questionHtml: string;
}

interface PublishResult {
  previewUrl: string;
  shareUrl: string;
  shareId: string;
}

export const publishRenderedPage = async (
  htmlContent: string,
  options: PublishOptions,
  req: Request,
): Promise<PublishResult> => {
  await Promise.all([ensurePagesDirectory(), ensureShareMetadataDirectory()]);
  const shareId = nanoid(12);
  const sharePath = `/share/${shareId}`;
  const shareUrl = buildPublicAssetUrl(sharePath, req);
  const previewDocument = buildHtmlDocument(htmlContent, {
    model: options.model,
    shareLink: shareUrl,
    pageTitle: 'AI 回复预览',
  });
  const previewRelativePath = await savePageHtml(previewDocument, 'preview');

  const shareDocument = buildHtmlDocument(htmlContent, {
    model: options.model,
    questionHtml: options.questionHtml,
    pageTitle: 'AI 回复分享',
  });
  const shareRelativePath = await savePageHtml(shareDocument, 'share', `${shareId}.html`);

  const imageFiles = extractLocalImageFiles(`${options.questionHtml}${htmlContent}`);
  await saveShareMetadata({ shareId, htmlRelativePath: shareRelativePath, imageFiles });

  return {
    previewUrl: buildPublicAssetUrl(previewRelativePath, req),
    shareUrl,
    shareId,
  };
};
