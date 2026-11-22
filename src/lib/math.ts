import type { MarkedExtension, Tokens } from 'marked';

/**
 * `$inline$` and `$$display$$` math. Rendering only emits escaped TeX in
 * placeholders; KaTeX is loaded lazily and fills them in (see enhance.ts),
 * so documents without math never download it.
 */

function escapeTex(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Opening `$` not escaped; content doesn't start/end with whitespace; closing
// `$` not followed by a digit (so "$5 and $10" stays plain text).
const INLINE = /^\$(?!\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/;
const DISPLAY = /^ {0,3}\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$[ \t]*(?:\n+|$)/;
const UNESCAPED_DOLLAR = /(?<!\\)\$/;

interface MathToken extends Tokens.Generic {
  text: string;
}

export const MATH_INLINE_CLASS = 'math-inline';
export const MATH_DISPLAY_CLASS = 'math-display';

export const mathExtension: MarkedExtension = {
  extensions: [
    {
      name: 'mathDisplay',
      level: 'block',
      start(src: string) {
        return /^ {0,3}\$\$/m.exec(src)?.index;
      },
      tokenizer(src: string): MathToken | undefined {
        const match = DISPLAY.exec(src);
        if (!match?.[1]?.trim()) return undefined;
        return { type: 'mathDisplay', raw: match[0], text: match[1].trim() };
      },
      renderer(token) {
        return `<div class="${MATH_DISPLAY_CLASS}">${escapeTex(String(token.text))}</div>\n`;
      },
    },
    {
      name: 'mathInline',
      level: 'inline',
      start(src: string) {
        const index = src.search(UNESCAPED_DOLLAR);
        return index === -1 ? undefined : index;
      },
      tokenizer(src: string): MathToken | undefined {
        const match = INLINE.exec(src);
        if (!match?.[1]) return undefined;
        return { type: 'mathInline', raw: match[0], text: match[1] };
      },
      renderer(token) {
        return `<span class="${MATH_INLINE_CLASS}">${escapeTex(String(token.text))}</span>`;
      },
    },
  ],
};
