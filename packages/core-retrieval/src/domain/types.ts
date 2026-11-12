export interface Document {
  readonly id: string;
  readonly text: string;
}

export interface ScoredDocument extends Document {
  readonly score: number;
}

export interface Tokenizer {
  tokenize(text: string): string[];
}
