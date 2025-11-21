type AIContentPart = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

export const extractAssistantMessage = (
  content: string | AIContentPart[] | null | undefined,
): string => {
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? '')
      .filter((text) => text.length > 0)
      .join('\n\n')
      .trim();
  }
  return '';
};
