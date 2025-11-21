import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { config } from '../config';
import { markdownItKatex } from './markdownKatex';

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

markdown.use(markdownItKatex);

const latexTags = [
  'span',
  'math',
  'semantics',
  'mrow',
  'mi',
  'mn',
  'mo',
  'mfrac',
  'msqrt',
  'mtable',
  'mtr',
  'mtd',
  'mstyle',
  'msup',
  'msub',
  'mover',
  'munder',
  'munderover',
  'mtext',
  'menclose',
  'mspace',
  'mpadded',
  'mfenced',
  'msubsup',
  'mphantom',
  'annotation',
];

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: Array.from(
    new Set(
      sanitizeHtml.defaults.allowedTags.concat([
        'img',
        'h1',
        'h2',
        'h3',
        'svg',
        'path',
        'details',
        'summary',
        ...latexTags,
      ]),
    ),
  ),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height'],
    a: ['href', 'title', 'target', 'rel'],
    span: ['class', 'style', 'aria-hidden'],
    div: ['class', 'style', 'aria-hidden'],
    details: ['open'],
    math: ['xmlns'],
    annotation: ['encoding'],
    svg: [
      'xmlns',
      'width',
      'height',
      'viewBox',
      'preserveAspectRatio',
      'focusable',
      'stroke',
      'fill',
    ],
    path: [
      'd',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-miterlimit',
      'stroke-dasharray',
      'stroke-dashoffset',
      'fill-rule',
      'transform',
    ],
    '*': ['aria-hidden', 'role'],
  },
  allowedStyles: {
    '*': {
      color: [/^.*$/],
      'background-color': [/^.*$/],
      'font-size': [/^.*$/],
      'font-family': [/^.*$/],
      'line-height': [/^.*$/],
      'text-align': [/^.*$/],
      'margin-left': [/^.*$/],
      'margin-right': [/^.*$/],
      'margin-top': [/^.*$/],
      'margin-bottom': [/^.*$/],
      'padding-left': [/^.*$/],
      'padding-right': [/^.*$/],
      'padding-top': [/^.*$/],
      'padding-bottom': [/^.*$/],
      position: [/^.*$/],
      top: [/^.*$/],
      right: [/^.*$/],
      bottom: [/^.*$/],
      left: [/^.*$/],
      display: [/^.*$/],
      width: [/^.*$/],
      height: [/^.*$/],
      'vertical-align': [/^.*$/],
      transform: [/^.*$/],
      'border-left': [/^.*$/],
      'border-right': [/^.*$/],
      'border-top': [/^.*$/],
      'border-bottom': [/^.*$/],
    },
  },
  allowedSchemes: sanitizeHtml.defaults.allowedSchemes.concat(['data']),
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

const stripKatexMathML = (html: string): string =>
  html.replace(/<span[^>]*class="[^"]*\bkatex-mathml\b[^"]*"[^>]*>[\s\S]*?<\/span>/g, '');

const normalizeMathBlocks = (input: string): string =>
  input.replace(/```(math|latex|tex)\s*([\s\S]*?)```/gi, (_match, _lang, body) => {
    const trimmed = body.trim();
    return `\n$$\n${trimmed}\n$$\n`;
  });

export const renderMarkdownToHtml = (content: string): string => {
  const normalized = normalizeMathBlocks(content);
  const html = markdown.render(normalized);
  const processed = config.sanitizeHtmlEnabled ? sanitizeHtml(html, sanitizeOptions) : html;
  return stripKatexMathML(processed);
};
