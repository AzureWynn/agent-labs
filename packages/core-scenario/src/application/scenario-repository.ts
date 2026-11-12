import type { Scenario } from '../domain/scenario.js';

/**
 * 应用层只依赖这个接口。
 * 文件系统、数据库、远程存储都只是它的实现。
 */
export interface ScenarioRepository {
  load(name: string): Scenario;
  list(): string[];
}
