import type MarkdownIt from 'markdown-it';
import katex, { type KatexOptions } from 'katex';

type Token = MarkdownIt.Token;
type StateInline = MarkdownIt.StateInline;
type StateBlock = MarkdownIt.StateBlock;

interface DelimiterInfo {
  canOpen: boolean;
  canClose: boolean;
}

const isValidDelim = (state: StateInline, pos: number): DelimiterInfo => {
  const max = state.posMax;
  const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  const nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;

  let canOpen = true;
  let canClose = true;

  if (prevChar === 0x20 || prevChar === 0x09 || (nextChar >= 0x30 && nextChar <= 0x39)) {
    canClose = false;
  }
  if (nextChar === 0x20 || nextChar === 0x09) {
    canOpen = false;
  }

  return { canOpen, canClose };
};

const mathInlineRule = (state: StateInline, silent: boolean): boolean => {
  if (state.src[state.pos] !== '$') {
    return false;
  }

  let match = state.pos + 1;
  const start = match;
  let escCount: number;

  const initialDelim = isValidDelim(state, state.pos);
  if (!initialDelim.canOpen) {
    if (!silent) {
      state.pending += '$';
    }
    state.pos += 1;
    return true;
  }

  while ((match = state.src.indexOf('$', match)) !== -1) {
    escCount = 0;
    let cursor = match - 1;
    while (cursor >= 0 && state.src[cursor] === '\\') {
      cursor -= 1;
      escCount += 1;
    }
    if (escCount % 2 === 0) {
      break;
    }
    match += 1;
  }

  if (match === -1) {
    if (!silent) {
      state.pending += '$';
    }
    state.pos = start;
    return true;
  }

  if (match - start === 0) {
    if (!silent) {
      state.pending += '$$';
    }
    state.pos = start + 1;
    return true;
  }

  const finalDelim = isValidDelim(state, match);
  if (!finalDelim.canClose) {
    if (!silent) {
      state.pending += '$';
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 1;
  return true;
};

const mathBlockRule = (state: StateBlock, start: number, end: number, silent: boolean): boolean => {
  const initialLineStart = state.bMarks[start];
  const initialShift = state.tShift[start] ?? 0;
  const initialMax = state.eMarks[start];

  if (initialLineStart === undefined || initialMax === undefined) {
    return false;
  }

  let pos = initialLineStart + initialShift;
  let max = initialMax;

  if (pos + 2 > max) {
    return false;
  }
  if (state.src.slice(pos, pos + 2) !== '$$') {
    return false;
  }

  pos += 2;
  let firstLine = state.src.slice(pos, max);
  let lastLine = '';
  let found = false;
  let next = start;
  let lastPos = 0;

  if (silent) {
    return true;
  }

  if (firstLine.trim().slice(-2) === '$$') {
    firstLine = firstLine.trim().slice(0, -2);
    found = true;
  }

  while (!found) {
    next += 1;
    if (next >= end) {
      break;
    }

    const lineStart = state.bMarks[next];
    const shift = state.tShift[next] ?? 0;
    const currentMax = state.eMarks[next];

    if (lineStart === undefined || currentMax === undefined) {
      break;
    }

    pos = lineStart + shift;

    if (pos < currentMax && (state.tShift[next] ?? 0) < state.blkIndent) {
      break;
    }

    const line = state.src.slice(pos, currentMax).trim();
    if (line.slice(-2) === '$$') {
      lastPos = state.src.slice(0, currentMax).lastIndexOf('$$');
      lastLine = state.src.slice(pos, lastPos);
      found = true;
    }
  }

  state.line = next + 1;

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.map = [start, state.line];
  token.markup = '$$';
  token.content = `${firstLine && firstLine.trim() ? `${firstLine}\n` : ''}${state.getLines(
    start + 1,
    next,
    state.tShift[start] ?? 0,
    true,
  )}${lastLine && lastLine.trim() ? lastLine : ''}`;

  return true;
};

export interface MarkdownItKatexOptions extends KatexOptions {
  onError?: (error: Error, latex: string, displayMode: boolean) => void;
}

const defaultKatexOptions: KatexOptions = {
  throwOnError: false,
  strict: 'ignore',
  trust: true,
  output: 'html',
};

const renderWithKatex = (
  latex: string,
  displayMode: boolean,
  options: KatexOptions,
  onError?: (error: Error, latex: string, displayMode: boolean) => void,
): string => {
  try {
    return katex.renderToString(latex, { ...options, displayMode });
  } catch (error) {
    onError?.(error as Error, latex, displayMode);
    if (options.throwOnError) {
      throw error;
    }
    return latex;
  }
};

export const markdownItKatex = (md: MarkdownIt, opts?: MarkdownItKatexOptions): void => {
  const mergedOptions = { ...defaultKatexOptions, ...(opts ?? {}) };
  const onError = opts?.onError;

  const inlineRenderer = (tokens: Token[], idx: number): string => {
    const token = tokens[idx];
    if (!token) {
      return '';
    }
    return renderWithKatex(token.content, false, mergedOptions, onError);
  };

  const blockRenderer = (tokens: Token[], idx: number): string => {
    const token = tokens[idx];
    if (!token) {
      return '';
    }
    return `<p>${renderWithKatex(token.content, true, mergedOptions, onError)}</p>\n`;
  };

  md.inline.ruler.after('escape', 'math_inline', mathInlineRule);
  md.block.ruler.after('blockquote', 'math_block', mathBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.renderer.rules.math_inline = inlineRenderer;
  md.renderer.rules.math_block = blockRenderer;
};
