import type { Tokenizer } from './types.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'of', 'and', 'or', 'in', 'on', 'to', 'for', 'with', 'by', 'from',
  'as', 'at', 'it', 'this', 'that', 'these', 'those', 'we', 'you',
  'he', 'she', 'they', 'them', 'his', 'her', 'its', 'our', 'your',
  'but', 'not', 'no', 'yes', 'if', 'then', 'else', 'when', 'while',
  'do', 'does', 'did', 'has', 'have', 'had', 'will', 'would', 'can',
  'could', 'should', 'may', 'might', 'must', 'shall', 's', 't',
]);

const TOKEN_RE =
  /[A-Za-z0-9._+#-]+@[A-Za-z0-9._-]+\.[A-Za-z]{2,}|0x[0-9a-fA-F]+|#[0-9a-fA-F]{3,8}|\b[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+\b|\b[A-Za-z]*[0-9]+[A-Za-z0-9]*\b|[A-Za-z]{2,}|[0-9]+(?:\.[0-9]+)+|[0-9]+/g;

const CJK_RE = /[\u4e00-\u9fff]+/g;

function normalizeTechTerms(text: string): string {
  return text
    .replace(/c\+\+/gi, ' cpp ')
    .replace(/\.net\b/gi, ' dotnet ')
    .replace(/node\.js/gi, ' nodejs ');
}

export interface BookTokenizerOptions {
  /**
   * 默认开启中文二元组。
   * 设为 false 可以复现"只认拉丁字母、中文整段丢失"的旧行为。
   */
  readonly cjkBigrams?: boolean;
}

export class BookTokenizer implements Tokenizer {
  private readonly cjkBigrams: boolean;

  constructor(options: BookTokenizerOptions = {}) {
    this.cjkBigrams = options.cjkBigrams ?? true;
  }

  tokenize(text: string): string[] {
    const normalized = normalizeTechTerms(text);
    const latin = (normalized.match(TOKEN_RE) ?? [])
      .map((token) => token.toLowerCase())
      .filter((token) => !STOPWORDS.has(token))
      .filter((token) => token.length > 0);

    if (!this.cjkBigrams) return latin;
    return [...latin, ...this.extractCjk(normalized)];
  }

  private extractCjk(text: string): string[] {
    const tokens: string[] = [];
    for (const run of text.match(CJK_RE) ?? []) {
      if (run.length === 1) {
        tokens.push(run);
        continue;
      }
      for (let i = 0; i < run.length - 1; i += 1) {
        tokens.push(run.slice(i, i + 2));
      }
    }
    return tokens;
  }
}
