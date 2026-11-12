import type { Scenario } from '@agentlab/core-scenario';
import { evaluate } from '../domain/evaluate.js';
import type { MethodOutcome, Retriever } from '../domain/evaluate.js';
import type { RunWriter } from './run-writer.js';

export interface RunEvalRequest {
  readonly scenario: Scenario;
  readonly retrievers: readonly Retriever[];
  readonly k: number;
  readonly label: string;
  readonly writer?: RunWriter;
}

export interface RunEvalResult {
  readonly methods: MethodOutcome[];
  readonly file?: string;
}

export function runEval(request: RunEvalRequest): RunEvalResult {
  const methods = evaluate(request.scenario, request.retrievers, request.k);
  const file = request.writer?.write({
    scenario: request.scenario.name,
    label: request.label,
    k: request.k,
    methods,
  });
  return { methods, file };
}
