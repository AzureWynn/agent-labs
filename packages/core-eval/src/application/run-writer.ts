import type { MethodOutcome } from '../domain/evaluate.js';

export interface RunInput {
  readonly scenario: string;
  readonly label: string;
  readonly k: number;
  readonly methods: readonly MethodOutcome[];
}

/**
 * 应用层端口。文件、对象存储、数据库都实现它。
 */
export interface RunWriter {
  write(input: RunInput): string;
}
