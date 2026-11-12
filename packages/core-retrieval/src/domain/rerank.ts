import type { Document, ScoredDocument, Tokenizer } from './types.js';

export interface RerankedDocument extends ScoredDocument {
  readonly baseScore: number;
  readonly phraseBonus: number;
  readonly coverageBonus: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phraseMatch(documentText: string, queryText: string): boolean {
  if (queryText.length === 0) return false;
  if (/[\u4e00-\u9fff]/.test(queryText)) {
    return documentText.replace(/\s+/g, '').includes(queryText.replace(/\s+/g, ''));
  }
  const pattern = queryText
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => `\\b${escapeRegExp(word)}\\b`)
    .join('.*?');
  return pattern.length > 0 && new RegExp(pattern).test(` ${documentText} `);
}

/**
 * 轻量重排：融合排名作底分，连续短语和查询词覆盖作加成。
 * 不调用模型，结果可复现。
 */
export function rerank(
  query: string,
  docs: readonly Document[],
  fusedRank: ReadonlyMap<string, number>,
  tokenizer: Tokenizer,
): RerankedDocument[] {
  const queryTerms = [...new Set(tokenizer.tokenize(query))];
  const queryNorm = normalize(query);

  return docs
    .map((doc) => {
      const rank = fusedRank.get(doc.id) ?? docs.length;
      const baseScore = 1 / (rank + 1);
      const documentNorm = normalize(doc.text);
      const phraseBonus = phraseMatch(documentNorm, queryNorm) ? 0.5 : 0;

      const documentTerms = new Set(tokenizer.tokenize(doc.text));
      const matched = queryTerms.filter((term) => documentTerms.has(term)).length;
      const coverageBonus = queryTerms.length > 0 ? 0.5 * (matched / queryTerms.length) : 0;

      return {
        id: doc.id,
        text: doc.text,
        score: baseScore + phraseBonus + coverageBonus,
        baseScore,
        phraseBonus,
        coverageBonus,
      };
    })
    .sort((left, right) => right.score - left.score);
}
