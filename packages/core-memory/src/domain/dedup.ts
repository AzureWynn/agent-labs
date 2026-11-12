import type { MemoryItem } from './memory.js';

export const DEFAULT_NEAR_DUPLICATE_THRESHOLD = 0.75;
export const MIN_CONTENT_TOKENS = 1;

const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });

const CONTENT_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been',
  'i', 'my', 'me', 'you', 'your', 'he', 'she', 'his', 'her', 'it', 'its',
  'they', 'their', 'we', 'our', 'user', 'users', 'name', 'named',
  'and', 'or', 'as', 'at', 'in', 'on', 'of', 'to', 'for', 'with',
  'works', 'work', 'working', 'has', 'have', 'had', 'does', 'do',
  'that', 'this', 'also', 'very',
  '的', '了', '是', '在', '有', '和', '与', '我', '你', '他', '她', '它',
  '我们', '你们', '他们', '用户', '主人', '叫', '名叫',
  '住', '住在', '一个', '一只', '一位', '这', '那', '这个', '那个',
  '什么', '时候', '哪', '几', '多少', '下次', '需要', '建议',
  '对', '会', '吃', '喝', '养', '养了', '打', '安排', '已经', '还有', '就是',
  '名字', '猫叫', '狗叫', '我的', '有事', '找',
]);

const QUERY_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been',
  'i', 'my', 'me', 'you', 'your', 'he', 'she', 'his', 'her', 'it', 'its',
  'they', 'their', 'we', 'our', 'and', 'or', 'as', 'at', 'in', 'on', 'of',
  'to', 'for', 'with', 'that', 'this', 'also', 'very',
  '的', '了', '是', '在', '有', '和', '与', '我', '你', '他', '她', '它',
  '我们', '你们', '他们', '这', '那', '这个', '那个', '什么', '时候',
  '什么时候', '什么样', '我家', '哪', '几', '多少', '吗', '呢', '吧', '啊',
]);

const NEGATIONS = ['不', '没', '无', '未', '禁', '避免'];

export function normalizeContent(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function segmentWords(text: string): string[] {
  return [...segmenter.segment(normalizeContent(text))]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment)
    .filter((token) => token.length > 0);
}

function tokenize(text: string, stopwords: ReadonlySet<string>): string[] {
  return segmentWords(text).filter((token) => !stopwords.has(token));
}

export function contentTokens(text: string): string[] {
  return tokenize(text, CONTENT_STOPWORDS);
}

export function queryTokens(text: string): string[] {
  return tokenize(text, QUERY_STOPWORDS);
}

export function contentTokenSet(text: string): Set<string> {
  return new Set(contentTokens(text));
}

export function numericTokens(text: string): Set<string> {
  return new Set(normalizeContent(text).match(/\d+(?:\.\d+)?/g) ?? []);
}

export function hasNegation(text: string): boolean {
  const normalized = normalizeContent(text);
  return NEGATIONS.some((word) => normalized.includes(word));
}

export function overlapCoefficient(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / Math.min(left.size, right.size);
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

export interface DuplicateMatch {
  readonly item: MemoryItem;
  readonly kind: 'exact' | 'near';
}

export function findDuplicate(
  items: readonly MemoryItem[],
  content: string,
  threshold = DEFAULT_NEAR_DUPLICATE_THRESHOLD,
): DuplicateMatch | undefined {
  const normalized = normalizeContent(content);
  const exact = items.find((item) => normalizeContent(item.content) === normalized);
  if (exact) return { item: exact, kind: 'exact' };

  const tokens = contentTokenSet(content);
  if (tokens.size < MIN_CONTENT_TOKENS) return undefined;
  const numbers = numericTokens(content);
  const negation = hasNegation(content);

  for (const item of items) {
    const other = contentTokenSet(item.content);
    if (other.size < MIN_CONTENT_TOKENS) continue;
    if (hasNegation(item.content) !== negation) continue;
    const otherNumbers = numericTokens(item.content);
    if (numbers.size > 0 && otherNumbers.size > 0 && !sameSet(numbers, otherNumbers)) {
      continue;
    }
    const longNumbers = [...numbers].filter((number) => number.length >= 6);
    if (longNumbers.some((number) => otherNumbers.has(number))) {
      return { item, kind: 'near' };
    }
    if (overlapCoefficient(tokens, other) >= threshold) {
      return { item, kind: 'near' };
    }
  }
  return undefined;
}
