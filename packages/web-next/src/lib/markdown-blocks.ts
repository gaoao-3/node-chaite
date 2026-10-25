const FENCE = /^ {0,3}(`{3,}|~{3})/;
const LIST_ITEM = /^(?:[*+-]|\d{1,9}[.)])(?:[ \t]|$)/;
const HTML_TAG = /<[A-Za-z!/?]/;
const INLINE_CODE = /`[^`]*`/g;

/**
 * Split only at safe top-level block boundaries. During streaming, completed
 * blocks stay memoized and only the final block is parsed again.
 * Never split inside code fences, math blocks, raw HTML or indented lists.
 */
export function splitMarkdownBlocks(markdown: string): string[] {
  const lines = markdown.split("\n");
  if (/^---[ \t]*\r?$/.test(lines[0])) return [markdown];

  const blocks: string[] = [];
  let current: string[] = [];
  let fence: { marker: string; size: number } | null = null;
  let inMath = false;
  let rawHtml = false;
  let afterBlank = false;

  for (const line of lines) {
    const blank = line.trim() === "";
    if (afterBlank && !blank && !fence && !inMath && !rawHtml && current.length > 0
      && !/^[ \t]/.test(line) && !LIST_ITEM.test(line)) {
      blocks.push(current.join("\n") + "\n");
      current = [];
    }
    current.push(line);

    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      const size = fenceMatch[1].length;
      if (!fence) fence = { marker, size };
      else if (marker === fence.marker && size >= fence.size) fence = null;
    } else if (!fence) {
      const prose = line.replace(INLINE_CODE, "");
      if (HTML_TAG.test(prose)) rawHtml = true;
      if ((prose.match(/\$\$/g)?.length ?? 0) % 2 === 1) inMath = !inMath;
    }
    afterBlank = blank;
  }

  blocks.push(current.join("\n"));
  return blocks;
}
