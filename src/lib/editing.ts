/**
 * Pure text transforms for editor keyboard commands. Each returns an `Edit`:
 * replace `value.slice(start, end)` with `text`, then select
 * `selectionStart..selectionEnd`. `main.ts` applies it as a native edit so
 * Ctrl+Z still works.
 */
export interface Edit {
  start: number;
  end: number;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export const INDENT = '  ';

const FENCE = /^\s{0,3}(```|~~~)/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[[ xX]\]\s+)?/;

function lineStartAt(value: string, index: number): number {
  return value.lastIndexOf('\n', index - 1) + 1;
}

function lineEndAt(value: string, index: number): number {
  const end = value.indexOf('\n', index);
  return end === -1 ? value.length : end;
}

/** Start/end of the full lines touched by a selection. */
function touchedLines(value: string, selStart: number, selEnd: number) {
  // A selection ending at the very start of a line doesn't include that line.
  const effectiveEnd =
    selEnd > selStart && value[selEnd - 1] === '\n' ? selEnd - 1 : selEnd;
  const start = lineStartAt(value, selStart);
  const end = lineEndAt(value, effectiveEnd);
  return { start, end, lines: value.slice(start, end).split('\n') };
}

/** True when the caret's line is a list item (outside fenced code). */
function onListItem(value: string, index: number): boolean {
  const lineStart = lineStartAt(value, index);
  return (
    LIST_ITEM.test(value.slice(lineStart, lineEndAt(value, index))) &&
    !insideFence(value, lineStart)
  );
}

export function indent(value: string, selStart: number, selEnd: number): Edit {
  const multiline = value.slice(selStart, selEnd).includes('\n');

  // On a list item, Tab nests the whole item rather than inserting spaces.
  if (!multiline && !onListItem(value, selStart)) {
    return {
      start: selStart,
      end: selEnd,
      text: INDENT,
      selectionStart: selStart + INDENT.length,
      selectionEnd: selStart + INDENT.length,
    };
  }

  const { start, end, lines } = touchedLines(value, selStart, selEnd);
  return {
    start,
    end,
    text: lines.map((line) => INDENT + line).join('\n'),
    selectionStart: selStart + INDENT.length,
    selectionEnd: selEnd + INDENT.length * lines.length,
  };
}

export function outdent(value: string, selStart: number, selEnd: number): Edit | null {
  const { start, end, lines } = touchedLines(value, selStart, selEnd);
  const removed = lines.map((line) => {
    if (line.startsWith('\t')) return 1;
    return line.match(/^ {1,2}/)?.[0].length ?? 0;
  });

  if (removed.every((count) => count === 0)) return null;

  const firstRemoved = removed[0] ?? 0;
  const totalRemoved = removed.reduce((sum, count) => sum + count, 0);
  return {
    start,
    end,
    text: lines.map((line, i) => line.slice(removed[i])).join('\n'),
    selectionStart: Math.max(start, selStart - firstRemoved),
    selectionEnd: Math.max(start, selEnd - totalRemoved),
  };
}

/** Wraps the selection in `marker` (e.g. `**`), or unwraps it if already wrapped. */
export function toggleWrap(
  value: string,
  selStart: number,
  selEnd: number,
  marker: string,
): Edit {
  const m = marker.length;
  const before = value.slice(selStart - m, selStart);
  const after = value.slice(selEnd, selEnd + m);

  if (selStart >= m && before === marker && after === marker) {
    return {
      start: selStart - m,
      end: selEnd + m,
      text: value.slice(selStart, selEnd),
      selectionStart: selStart - m,
      selectionEnd: selEnd - m,
    };
  }

  return {
    start: selStart,
    end: selEnd,
    text: marker + value.slice(selStart, selEnd) + marker,
    selectionStart: selStart + m,
    selectionEnd: selEnd + m,
  };
}

function insideFence(value: string, lineStart: number): boolean {
  let open = false;
  for (const line of value.slice(0, lineStart).split('\n')) {
    if (FENCE.test(line)) open = !open;
  }
  return open;
}

/**
 * Enter inside a list item: continue the list, or end it when the item is
 * empty. Returns null when Enter should behave normally.
 */
export function continueList(value: string, selStart: number, selEnd: number): Edit | null {
  if (selStart !== selEnd) return null;

  const lineStart = lineStartAt(value, selStart);
  const line = value.slice(lineStart, lineEndAt(value, selStart));
  const match = LIST_ITEM.exec(line);
  if (!match || selStart - lineStart < match[0].length) return null;
  if (insideFence(value, lineStart)) return null;

  const [prefix, indentation = '', marker = '-', spacing = ' ', task] = match;

  // Enter on an empty item ends the list and leaves a blank line.
  if (line.slice(prefix.length).trim() === '') {
    return {
      start: lineStart,
      end: lineStart + line.length,
      text: '',
      selectionStart: lineStart,
      selectionEnd: lineStart,
    };
  }

  const ordered = /^(\d+)([.)])$/.exec(marker);
  const nextMarker = ordered ? `${Number(ordered[1]) + 1}${ordered[2]}` : marker;
  const text = `\n${indentation}${nextMarker}${spacing}${task ? '[ ] ' : ''}`;

  return {
    start: selStart,
    end: selEnd,
    text,
    selectionStart: selStart + text.length,
    selectionEnd: selStart + text.length,
  };
}
