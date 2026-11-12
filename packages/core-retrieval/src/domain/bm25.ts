import type { Document, ScoredDocument, Tokenizer } from './types.js';

export interface Bm25Options {
  readonly k1?: number;
  readonly b?: number;
}

export interface TermContribution {
  readonly term: string;
  readonly termFrequency: number;
  readonly documentFrequency: number;
  readonly idf: number;
  readonly contribution: number;
}

export interface Bm25Explanation {
  readonly docId: string;
  readonly documentLength: number;
  readonly score: number;
  readonly terms: readonly TermContribution[];
}

export interface PostingEntry {
  readonly docId: string;
  readonly tf: number;
}

/**
 * BM25 只依赖 Tokenizer 接口，不关心语言。
 * 中文分词能力由注入的 Tokenizer 决定，索引本身不需要改。
 */
export class BM25Index {
  private readonly docs: readonly Document[];
  private readonly tokenizer: Tokenizer;
  private readonly k1: number;
  private readonly b: number;
  private readonly docLengths: readonly number[];
  private readonly df = new Map<string, number>();
  private readonly postings = new Map<string, Map<number, number>>();
  readonly avgdl: number;

  constructor(docs: readonly Document[], tokenizer: Tokenizer, options: Bm25Options = {}) {
    if (docs.length === 0) {
      throw new Error('BM25Index 至少需要一篇文档');
    }
    this.docs = docs;
    this.tokenizer = tokenizer;
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;

    const lengths: number[] = [];
    for (const doc of docs) {
      const tokens = tokenizer.tokenize(doc.text);
      lengths.push(tokens.length);
      const termFrequency = new Map<string, number>();
      for (const token of tokens) {
        termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
      }
      for (const [term, count] of termFrequency) {
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
        const posting = this.postings.get(term) ?? new Map<number, number>();
        posting.set(lengths.length - 1, count);
        this.postings.set(term, posting);
      }
    }

    this.docLengths = lengths;
    const total = lengths.reduce((sum, length) => sum + length, 0);
    this.avgdl = total / docs.length;
  }

  search(query: string, k: number): ScoredDocument[] {
    if (k <= 0) return [];
    const scores = new Array<number>(this.docs.length).fill(0);

    for (const term of new Set(this.tokenizer.tokenize(query))) {
      const posting = this.postings.get(term);
      if (!posting) continue;
      for (const [index, tf] of posting) {
        const docLength = this.docLengths[index] ?? 0;
        scores[index] = (scores[index] ?? 0) + this.termContribution(term, tf, docLength).contribution;
      }
    }

    return this.docs
      .map((doc, index) => ({ ...doc, score: scores[index] ?? 0 }))
      .filter((doc) => doc.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, k);
  }

  idf(term: string): number {
    const documentCount = this.docs.length;
    const documentFrequency = this.df.get(term.toLowerCase()) ?? 0;
    return Math.log(1 + (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
  }

  documentFrequency(term: string): number {
    return this.df.get(term.toLowerCase()) ?? 0;
  }

  postingList(term: string): PostingEntry[] {
    const posting = this.postings.get(term.toLowerCase());
    if (!posting) return [];
    return [...posting.entries()].map(([index, tf]) => ({
      docId: this.docs[index]?.id ?? `doc_${index}`,
      tf,
    }));
  }

  explain(query: string, docId: string): Bm25Explanation {
    const docIndex = this.docs.findIndex((doc) => doc.id === docId);
    if (docIndex < 0) throw new Error(`文档不存在: ${docId}`);

    const documentLength = this.docLengths[docIndex] ?? 0;
    const terms: TermContribution[] = [];
    for (const term of new Set(this.tokenizer.tokenize(query))) {
      const tf = this.postings.get(term)?.get(docIndex);
      if (tf === undefined) continue;
      const { idf, contribution } = this.termContribution(term, tf, documentLength);
      terms.push({
        term,
        termFrequency: tf,
        documentFrequency: this.documentFrequency(term),
        idf,
        contribution,
      });
    }
    terms.sort((left, right) => right.contribution - left.contribution);

    return {
      docId,
      documentLength,
      score: terms.reduce((sum, term) => sum + term.contribution, 0),
      terms,
    };
  }

  vocabularySize(): number {
    return this.df.size;
  }

  private termContribution(
    term: string,
    tf: number,
    docLength: number,
  ): { idf: number; contribution: number } {
    const idf = this.idf(term);
    const normalization = 1 - this.b + this.b * (docLength / (this.avgdl || 1));
    const denominator = tf + this.k1 * normalization;
    return {
      idf,
      contribution: denominator > 0 ? idf * ((tf * (this.k1 + 1)) / denominator) : 0,
    };
  }
}
