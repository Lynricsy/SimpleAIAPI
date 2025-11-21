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
        <button id="copy-share" data-share-link="${options.shareLink}">📤 复制分享链接</button>
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
  const prismScript = `<script>
    (() => {
      document.addEventListener('DOMContentLoaded', () => {
        if (window.Prism) {
          Prism.highlightAll();
        }
      });
    })();
  </script>`;
  return `<!DOCTYPE html>
<html lang="zh-Hans">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.pageTitle ?? 'AI 回复预览'}</title>
    ${getKatexStyleTag()}
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css" />
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
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
        --code-bg: #1e1e1e;
        --code-text: #e2e8f0;
        --inline-code-bg: rgba(99, 102, 241, 0.08);
        --inline-code-text: #5b21b6;
        --table-border: rgba(15, 23, 42, 0.08);
        --katex-bg: rgba(99, 102, 241, 0.04);
        --tool-card-bg: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
        --tool-card-border: rgba(99, 102, 241, 0.2);
        --tool-header-bg: rgba(99, 102, 241, 0.08);
        --shadow-sm: 0 2px 8px rgba(15, 23, 42, 0.08);
        --shadow-md: 0 4px 16px rgba(15, 23, 42, 0.12);
        --shadow-lg: 0 10px 40px rgba(15, 23, 42, 0.15);
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
          --inline-code-bg: rgba(139, 92, 246, 0.2);
          --inline-code-text: #c4b5fd;
          --table-border: rgba(148, 163, 184, 0.3);
          --katex-bg: rgba(59, 130, 246, 0.08);
          --tool-card-bg: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
          --tool-card-border: rgba(99, 102, 241, 0.4);
          --tool-header-bg: rgba(99, 102, 241, 0.15);
          --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
          --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
          --shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.5);
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
        width: min(900px, 96vw);
        background: var(--card-bg);
        border-radius: 18px;
        box-shadow: var(--shadow-lg);
        padding: 32px 40px;
        color: var(--card-text);
        backdrop-filter: blur(10px);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        font-size: 0.9rem;
        color: var(--meta-text);
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--table-border);
      }
      .bubble {
        position: relative;
        padding: 2rem;
        border-radius: 16px;
        background: var(--bubble-bg);
        border: 1px solid var(--bubble-border);
        font-size: 1.05rem;
        line-height: 1.8;
        color: var(--bubble-text);
        box-shadow: var(--shadow-sm);
      }
      .bubble :is(h1, h2, h3, h4, h5, h6) {
        color: var(--bubble-heading);
        margin-top: 2rem;
        margin-bottom: 1rem;
        font-weight: 600;
        line-height: 1.3;
      }
      .bubble h1 {
        font-size: 2rem;
        border-bottom: 2px solid var(--bubble-border);
        padding-bottom: 0.5rem;
      }
      .bubble h2 {
        font-size: 1.6rem;
      }
      .bubble h3 {
        font-size: 1.3rem;
      }
      .bubble pre {
        position: relative;
        background: var(--code-bg) !important;
        padding: 0 !important;
        border-radius: 12px;
        overflow: hidden;
        margin: 1.5rem 0;
        box-shadow: var(--shadow-md);
        border: 1px solid rgba(99, 102, 241, 0.1);
      }
      .bubble pre code {
        display: block;
        padding: 1.25rem !important;
        background: transparent !important;
        color: var(--code-text);
        font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 0.9rem;
        line-height: 1.6;
        overflow-x: auto;
        tab-size: 2;
      }
      .bubble :not(pre) > code {
        background: var(--inline-code-bg);
        color: var(--inline-code-text);
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
        font-size: 0.9em;
        font-weight: 500;
        border: 1px solid rgba(99, 102, 241, 0.15);
      }
      .bubble img {
        max-width: 100%;
        border-radius: 14px;
        margin: 1.5rem 0;
        box-shadow: var(--shadow-md);
      }
      .bubble table {
        width: 100%;
        border-collapse: collapse;
        margin: 1.5rem 0;
        font-size: 0.95rem;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
      }
      .bubble table th {
        background: var(--tool-header-bg);
        font-weight: 600;
        text-align: left;
        padding: 0.9rem;
        border: 1px solid var(--table-border);
      }
      .bubble table td {
        border: 1px solid var(--table-border);
        padding: 0.8rem;
      }
      .bubble ul,
      .bubble ol {
        padding-left: 1.8rem;
        margin: 1rem 0;
      }
      .bubble li {
        margin: 0.5rem 0;
      }
      .bubble blockquote {
        margin: 1.5rem 0;
        padding: 1rem 1.5rem;
        border-left: 4px solid rgba(99, 102, 241, 0.5);
        background: rgba(99, 102, 241, 0.05);
        border-radius: 8px;
        color: var(--bubble-text);
      }
      .bubble a {
        color: #6366f1;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s;
      }
      .bubble a:hover {
        border-bottom-color: #6366f1;
      }
      .question-panel {
        border: 1px solid var(--table-border);
        border-radius: 14px;
        padding: 1.5rem 2rem;
        margin-bottom: 2rem;
        background: rgba(99, 102, 241, 0.06);
        box-shadow: var(--shadow-sm);
      }
      .question-panel h2 {
        margin-top: 0;
        font-size: 1.3rem;
        color: var(--bubble-heading);
      }
      .question-block {
        border-radius: 12px;
        padding: 1.2rem;
        margin-top: 1rem;
        background: rgba(255, 255, 255, 0.5);
        border: 1px solid var(--table-border);
      }
      @media (prefers-color-scheme: dark) {
        .question-block {
          background: rgba(30, 41, 59, 0.5);
        }
      }
      .question-block header {
        font-weight: 700;
        margin-bottom: 0.7rem;
        color: var(--bubble-heading);
      }
      .question-block img {
        max-width: 100%;
        border-radius: 12px;
        margin-top: 0.8rem;
        box-shadow: var(--shadow-sm);
      }
      .share-panel {
        margin-top: 2rem;
        padding: 1rem;
        text-align: center;
      }
      .share-panel button {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        color: #fff;
        padding: 0.9rem 2rem;
        font-size: 1rem;
        font-weight: 500;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: var(--shadow-sm);
      }
      .share-panel button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
      }
      .katex-display {
        overflow-x: auto;
        padding: 1.2rem;
        margin: 1.5rem 0;
        border-radius: 12px;
        background: var(--katex-bg);
        border: 1px solid rgba(99, 102, 241, 0.15);
        box-shadow: var(--shadow-sm);
      }
      .katex {
        font-size: 1.1em;
      }
      details {
        margin: 1rem 0;
        border: 1px solid var(--tool-card-border);
        border-radius: 10px;
        padding: 0.8rem 1.2rem;
        background: var(--tool-card-bg);
        box-shadow: var(--shadow-sm);
        transition: all 0.3s;
      }
      details[open] {
        padding-bottom: 1.2rem;
        box-shadow: var(--shadow-md);
      }
      details summary {
        cursor: pointer;
        font-weight: 600;
        color: var(--bubble-heading);
        padding: 0.5rem 0;
        list-style: none;
        user-select: none;
        transition: color 0.2s;
      }
      details summary::-webkit-details-marker {
        display: none;
      }
      details summary::before {
        content: '▶';
        display: inline-block;
        margin-right: 0.5rem;
        transition: transform 0.3s;
      }
      details[open] summary::before {
        transform: rotate(90deg);
      }
      details summary:hover {
        color: #6366f1;
      }
      .tool-call-card {
        margin: 2rem 0;
        padding: 1.5rem;
        background: var(--tool-card-bg);
        border: 2px solid var(--tool-card-border);
        border-radius: 14px;
        box-shadow: var(--shadow-md);
        transition: all 0.3s;
      }
      .tool-call-card:hover {
        box-shadow: var(--shadow-lg);
        border-color: #6366f1;
      }
      .tool-call-card h3 {
        margin-top: 0;
        font-size: 1.25rem;
        color: #6366f1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .tool-call-card h3 code {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
        color: #6366f1;
        padding: 0.3rem 0.8rem;
        border-radius: 8px;
        font-size: 0.9em;
        border: 1px solid rgba(99, 102, 241, 0.3);
      }
      .tool-params {
        background: rgba(99, 102, 241, 0.03);
        border-color: rgba(99, 102, 241, 0.2);
      }
      .tool-params summary {
        color: #6366f1;
        font-size: 0.95rem;
      }
      .tool-result {
        margin-top: 1rem;
      }
      .tool-result-success {
        background: rgba(34, 197, 94, 0.05);
        border-color: rgba(34, 197, 94, 0.3);
      }
      .tool-result-success summary {
        color: #16a34a;
      }
      .tool-result-error {
        background: rgba(239, 68, 68, 0.05);
        border-color: rgba(239, 68, 68, 0.3);
      }
      .tool-result-error summary {
        color: #dc2626;
      }
      .tool-round {
        margin: 2rem 0;
        padding: 1.5rem;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(139, 92, 246, 0.03));
        border-radius: 16px;
        border: 1px solid var(--bubble-border);
      }
      .tool-round h2 {
        margin-top: 0;
        padding-bottom: 1rem;
        border-bottom: 2px solid var(--tool-card-border);
        color: #6366f1;
        font-size: 1.4rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      @media (max-width: 640px) {
        body {
          padding: 16px;
        }
        .card {
          padding: 20px 24px;
        }
        .bubble {
          font-size: 0.98rem;
          padding: 1.5rem;
        }
        .bubble h1 {
          font-size: 1.6rem;
        }
        .bubble h2 {
          font-size: 1.35rem;
        }
        .bubble pre code {
          font-size: 0.85rem;
        }
        .katex-display {
          font-size: 1rem;
          padding: 1rem;
        }
        .question-panel {
          padding: 1.2rem;
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
    ${prismScript}
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
