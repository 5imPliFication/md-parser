import { describe, expect, it } from 'vitest';
import type { Edit } from './editing';
import {
  continueList,
  findTaskMarkers,
  indent,
  outdent,
  setTaskChecked,
  toggleWrap,
} from './editing';

/** Applies an edit; `|` marks the caret and `[ ]` a selection in the result. */
function apply(value: string, edit: Edit | null): string {
  if (!edit) return 'NULL';
  const next = value.slice(0, edit.start) + edit.text + value.slice(edit.end);
  if (edit.selectionStart === edit.selectionEnd) {
    return next.slice(0, edit.selectionStart) + '|' + next.slice(edit.selectionStart);
  }
  return (
    next.slice(0, edit.selectionStart) +
    '[' +
    next.slice(edit.selectionStart, edit.selectionEnd) +
    ']' +
    next.slice(edit.selectionEnd)
  );
}

/** Parses `|` or `[...]` markers out of a test string. */
function at(marked: string): [string, number, number] {
  const caret = marked.indexOf('|');
  if (caret !== -1) {
    return [marked.slice(0, caret) + marked.slice(caret + 1), caret, caret];
  }
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return [marked.replace('[', '').replace(']', ''), start, end];
}

const run = <T extends unknown[]>(
  fn: (value: string, s: number, e: number, ...rest: T) => Edit | null,
  marked: string,
  ...rest: T
) => {
  const [value, s, e] = at(marked);
  return apply(value, fn(value, s, e, ...rest));
};

describe('indent', () => {
  it('inserts spaces at the caret', () => {
    expect(run(indent, 'ab|c')).toBe('ab  |c');
  });

  it('replaces a single-line selection with spaces', () => {
    expect(run(indent, 'a[bc]d')).toBe('a  |d');
  });

  it('indents every selected line and keeps the selection', () => {
    expect(run(indent, '- [a\n- b]\n- c')).toBe('  - [a\n  - b]\n- c');
  });

  it('nests a whole list item when the caret is on it', () => {
    expect(run(indent, '- a\n- b|c')).toBe('- a\n  - b|c');
    expect(run(indent, '1. [x]')).toBe('  1. [x]');
  });

  it('inserts spaces on list-looking lines inside fenced code', () => {
    expect(run(indent, '```\n- a|')).toBe('```\n- a  |');
  });

  it('ignores a line the selection only touches at its start', () => {
    expect(run(indent, '[a\nb\n]c')).toBe('  [a\n  b\n]c');
  });
});

describe('outdent', () => {
  it('removes up to two leading spaces from the current line', () => {
    expect(run(outdent, '    a|b')).toBe('  a|b');
    expect(run(outdent, ' a|b')).toBe('a|b');
  });

  it('removes a leading tab', () => {
    expect(run(outdent, '\ta|')).toBe('a|');
  });

  it('outdents every selected line', () => {
    expect(run(outdent, '  [a\n    b]')).toBe('[a\n  b]');
  });

  it('does nothing when no line is indented', () => {
    expect(run(outdent, 'a|b')).toBe('NULL');
  });
});

describe('toggleWrap', () => {
  it('wraps the selection', () => {
    expect(run(toggleWrap, 'a [bold] c', '**')).toBe('a **[bold]** c');
  });

  it('places the caret between markers for an empty selection', () => {
    expect(run(toggleWrap, 'a |c', '*')).toBe('a *|*c');
  });

  it('unwraps an already wrapped selection', () => {
    expect(run(toggleWrap, 'a **[bold]** c', '**')).toBe('a [bold] c');
  });
});

describe('continueList', () => {
  it('continues bullet lists with the same marker and indentation', () => {
    expect(run(continueList, '  * item|')).toBe('  * item\n  * |');
  });

  it('increments ordered list numbers', () => {
    expect(run(continueList, '9. nine|')).toBe('9. nine\n10. |');
    expect(run(continueList, '1) one|')).toBe('1) one\n2) |');
  });

  it('continues task lists with an unchecked box', () => {
    expect(run(continueList, '- [x] done|')).toBe('- [x] done\n- [ ] |');
  });

  it('splits an item when Enter is pressed mid-text', () => {
    expect(run(continueList, '- ab|cd')).toBe('- ab\n- |cd');
  });

  it('ends the list on an empty item', () => {
    expect(run(continueList, 'x\n- |')).toBe('x\n|');
    expect(run(continueList, '- [ ] |')).toBe('|');
  });

  it('leaves Enter alone outside lists, inside the marker, or with a selection', () => {
    expect(run(continueList, 'plain|')).toBe('NULL');
    expect(run(continueList, '-| item')).toBe('NULL');
    expect(run(continueList, '- [it]em')).toBe('NULL');
    expect(run(continueList, '-notalist|')).toBe('NULL');
  });

  it('leaves Enter alone inside fenced code', () => {
    expect(run(continueList, '```\n- not a list|')).toBe('NULL');
    expect(run(continueList, '```\ncode\n```\n- list|')).toBe('```\ncode\n```\n- list\n- |');
  });
});

describe('findTaskMarkers', () => {
  const source = [
    '- [ ] one', // marker at 3
    '* [x] two',
    '1. [X] three',
    '- not a task',
    '- [y] not a task either',
    '```',
    '- [ ] inside code',
    '```',
    '> - [ ] quoted',
    '  - [ ] nested',
    '-[ ] no space',
  ].join('\n');

  it('finds markers in order, skipping code and non-tasks', () => {
    const chars = findTaskMarkers(source).map((at) => source.slice(at - 1, at + 2));
    expect(chars).toEqual(['[ ]', '[x]', '[X]', '[ ]', '[ ]']);
  });

  it('handles CRLF-free empty input', () => {
    expect(findTaskMarkers('')).toEqual([]);
  });
});

describe('setTaskChecked', () => {
  const source = '- [ ] a\n- [x] b';

  it('checks and unchecks the matching task', () => {
    const check = setTaskChecked(source, 0, true, 2);
    expect(check && source.slice(0, check.start) + check.text + source.slice(check.end)).toBe(
      '- [x] a\n- [x] b',
    );
    const uncheck = setTaskChecked(source, 1, false, 2);
    expect(uncheck && source.slice(0, uncheck.start) + uncheck.text + source.slice(uncheck.end)).toBe(
      '- [ ] a\n- [ ] b',
    );
  });

  it('refuses when the task count does not match the preview', () => {
    expect(setTaskChecked(source, 0, true, 3)).toBeNull();
  });

  it('refuses when the task is already in the requested state', () => {
    expect(setTaskChecked(source, 1, true, 2)).toBeNull();
  });

  it('refuses an out-of-range index', () => {
    expect(setTaskChecked(source, 5, true, 2)).toBeNull();
  });
});
