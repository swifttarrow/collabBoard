import {
  DEFAULT_STICKY,
  STICKY_FONT_SIZE,
  STICKY_TEXT_PADDING,
} from "@/components/canvas/constants";

/** Approx px per character at STICKY_FONT_SIZE for typical sans-serif. */
const PX_PER_CHAR = STICKY_FONT_SIZE * 0.6;
/** Line height multiplier. */
const LINE_HEIGHT = STICKY_FONT_SIZE * 1.25;

const MAX_STICKY_WIDTH = 500;
const MAX_STICKY_HEIGHT = 400;

/** Strip HTML tags to get plain text. Safe for display and measurement. */
export function stripHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Word-wrap text to fit within maxContentWidth (px). Returns lines. */
function wrapLines(plainText: string, maxContentWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = plainText.split(/\n+/);

  const charsPerLine = Math.max(5, Math.floor(maxContentWidth / PX_PER_CHAR));

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length <= charsPerLine) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        if (word.length > charsPerLine) {
          for (let i = 0; i < word.length; i += charsPerLine) {
            lines.push(word.slice(i, i + charsPerLine));
          }
          currentLine = "";
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

/**
 * Estimate sticky dimensions to fit the given text.
 * Uses font metrics heuristics (no DOM/canvas). Safe for server-side.
 */
export function measureStickyText(text: string): { width: number; height: number } {
  const plainText = stripHtml(text);
  if (!plainText) {
    return { width: DEFAULT_STICKY.width, height: DEFAULT_STICKY.height };
  }

  const maxContentWidth = MAX_STICKY_WIDTH - 2 * STICKY_TEXT_PADDING;
  const lines = wrapLines(plainText, maxContentWidth);

  const contentWidth = Math.max(
    ...lines.map((line) => line.length * PX_PER_CHAR),
    1
  );
  const contentHeight = lines.length * LINE_HEIGHT;

  const width = Math.round(
    Math.min(MAX_STICKY_WIDTH, Math.max(DEFAULT_STICKY.width, contentWidth + 2 * STICKY_TEXT_PADDING))
  );
  const height = Math.round(
    Math.min(MAX_STICKY_HEIGHT, Math.max(DEFAULT_STICKY.height, contentHeight + 2 * STICKY_TEXT_PADDING))
  );

  return { width, height };
}

/**
 * Measure text dimensions with snug height (no minimum). Use for labels.
 * When maxWidth is given, wraps to that width; otherwise uses natural width.
 */
export function measureTextSnug(
  text: string,
  maxWidth?: number
): { width: number; height: number } {
  const plainText = stripHtml(text);
  const minDim = 2 * STICKY_TEXT_PADDING + LINE_HEIGHT;
  if (!plainText) {
    return {
      width: maxWidth ?? minDim,
      height: minDim,
    };
  }

  const maxContentWidth = (maxWidth ?? MAX_STICKY_WIDTH) - 2 * STICKY_TEXT_PADDING;
  const lines = wrapLines(plainText, Math.max(maxContentWidth, 1));
  const contentWidth = Math.max(
    ...lines.map((line) => line.length * PX_PER_CHAR),
    1
  );
  const contentHeight = lines.length * LINE_HEIGHT;
  const height = Math.round(contentHeight + 2 * STICKY_TEXT_PADDING);

  if (maxWidth != null) {
    return { width: maxWidth, height };
  }
  const width = Math.round(
    Math.min(MAX_STICKY_WIDTH, contentWidth + 2 * STICKY_TEXT_PADDING)
  );
  return { width, height };
}
