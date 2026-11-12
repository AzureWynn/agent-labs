# Lab 04：用户记忆（Pack A）

## 这篇要回答

1. ADD-only 记忆在 30 轮复诊对话里会堆出多少重复？
2. 规则去重能把候选压到多少条？
3. 去重后的记忆还能不能检索到正确事实？
4. 修完重复之后，检索还会在哪些地方翻车？

## 数据

`v2/scenarios/pet-clinic-memory/scenario.json`

- 5 位用户 × 30 轮 = 150 轮对话。
- 每位用户 8 条规范事实：主人、宠物、年龄、健康、日程、电话、地址、照护。
- 每条事实在 30 轮里用 3~4 种说法重复出现。
- 每位用户 6 条查询：宠物名、年龄、健康、日程、电话、照护。
- 共 40 条规范事实、30 条查询。
- 全部为模板生成的合成数据，不含真实用户信息。

场景说明见 `v2/scenarios/pet-clinic-memory/notes.md`。

## 方法

### 抽取

- 模型：本地 Ollama `gemma4:latest`。
- 每 5 轮打包成一次请求，只暴露 `add_memory` 一个工具，模拟 ADD-only。
- `temperature: 0`，并发 4，失败重试 3 次。
- 抽取结果缓存为 `fixtures/pet-clinic-memory-gemma4.json`，记录模型和生成时间。
- `--live` 不在命令里；直接 `extract` 就是真实调用，加 `--force` 才会覆盖 fixture。

### 去重

复用 `@book/core-memory`：

- `Intl.Segmenter('zh', { granularity: 'word' })` 中文分词。
- 归一化：小写、去标点、压缩空白。
- 内容 stopwords 与查询 stopwords 分开，避免把查询里的“住哪”误删。
- 近似重复：token 重叠系数 ≥ `0.75`。
- 数字守卫：两边都有数字且集合不同，不合并（5月10日 ≠ 6月10日）。
- 否定守卫：一边有否定词、一边没有，不合并（过敏 ≠ 不过敏）。
- 长数字快捷：相同电话号（≥6 位）直接视为同一条。
- 合并时优先保留 token 超集；没有超集关系时，保留 token 更多的说法。
  这一步是为了避免“更长的说法”把“电话”这种属性词挤掉。

### 检索

- 词项打分：查询 token 与记忆 token 的交集大小。
- 查询 stopwords 去掉“什么、什么时候、我家”等疑问词。
- `legacySubstringSearch` 保留整串子串匹配，用来复现旧实现为什么搜不到。
- Recall@1/@3 在“去重后的真实记忆”上评估：候选记忆与 expected fact 的 token
  重叠系数 ≥ 0.5 记为命中；另用 40 条规范事实做精确 ID 对照。

## 复现

```bash
npm install
npm run -w @book/lab-04-user-memory generate
ollama pull gemma4:latest
npm run -w @book/lab-04-user-memory extract -- --concurrency 4 --batch-size 5
npm run -w @book/lab-04-user-memory benchmark -- --label memory-gemma4-batch5-dedup3
```

- `generate` 默认不覆盖已有场景；确实要改数据时加 `--force`。
- `extract` 默认不覆盖已有 fixture；重跑加 `--force`。
- `benchmark` 只读 fixture，不需要 Ollama；同一标签已存在会报错，换 `--label`。
- 环境变量：`OLLAMA_BASE_URL`、`OLLAMA_CHAT_MODEL`（或 `OLLAMA_MODEL`）、`OLLAMA_TIMEOUT_MS`。

## 结果（2026-10-21，gemma4:latest）

| 用户 | 轮次 | 原始候选 | 去重后 | 重复率 | Recall@1 | Recall@3 |
|---|---:|---:|---:|---:|---:|---:|
| u01 | 30 | 28 | 8 | 0.714 | 1.000 | 1.000 |
| u02 | 30 | 27 | 9 | 0.667 | 1.000 | 1.000 |
| u03 | 30 | 29 | 8 | 0.724 | 1.000 | 1.000 |
| u04 | 30 | 28 | 8 | 0.714 | 1.000 | 1.000 |
| u05 | 30 | 30 | 8 | 0.733 | 1.000 | 1.000 |
| **合计** | **150** | **142** | **41** | **0.711** | **1.000** | **1.000** |

对照：40 条规范事实的 Recall@1 / @3 都是 1.000。

原始结果（本地，不入库）：`runs/pet-clinic-memory/2026-10-21/memory-gemma4-batch5-dedup3.json`

## 发现

1. **重复不是偶发，是 ADD-only 的默认结果。** 150 轮里模型写了 142 条候选，去重后只剩 41 条，重复率 71.1%。同一件事被换几种说法反复写，模型不会主动说“这条已经有了”。

2. **去重后 41 条，规范事实 40 条，只多 1 条。** 多出来的是 u02 的主人名：`用户叫李先生，带豆豆来复诊` 和 `登记人是李先生` 没有被合并。没有出现完全无关的噪声；但这套 stopwords 和阈值是在这个场景上调的，不能当成通用结论。

3. **修一个地方会坏另一个地方。** 第一版去重是 51 条，重复率 64.1%。加上 stopwords 和长数字快捷后降到 41 条，但 u02/u05 的“电话是多少”突然 0 命中：合并时保留了更长的 `有事打...找我`，把“电话”这个词丢了。改成“优先保留 token 超集”后，41 条不变，电话检索恢复。三个 run 的标签分别是（本地 `runs/`，不入库）：
   - `memory-gemma4-batch5`：51 条，64.1%，Recall@1 1.000。
   - `memory-gemma4-batch5-dedup2`：41 条，71.1%，Recall@1 0.933。
   - `memory-gemma4-batch5-dedup3`：41 条，71.1%，Recall@1 1.000。

4. **旧检索的 bug 是整串子串匹配。** `花花疫苗` 搜不到 `花花下次疫苗是5月10日`，因为原文里没有连续的“花花疫苗”。改成词项打分后能召回；但词项打分也有边界：`王女士电话` 会把“用户是王女士”排在电话记忆前面，因为实体词比属性词多。基准里用 `电话是多少` 测属性检索，`王女士电话` 作为诊断用例保留在 `retrieval.test.ts`。

5. **去重规则不是越严越好。** 阈值 0.75 能合并“花花对鸡肉过敏 / 花花对鸡肉严重过敏”，但会放过“李先生”的两种说法；数字守卫能挡住 5月10日 vs 6月10日，否定守卫能挡住“过敏 / 不过敏”。真正难的是短事实加了一点上下文之后，token 重叠被稀释。

## 边界

- 合成模板数据，不是真实对话；5 个用户、30 轮，规模很小。
- 只跑了一个模型、一次抽取，`temperature: 0`，没有方差估计。
- 查询是按规范事实设计的，Recall@1/@3 偏乐观。
- 去重阈值、stopwords、长数字规则都在这个场景上调过，换场景要重新校准。
- 检索是纯词项，没有用 embedding；Dense 在 Pack C 的 lab-03，融合是下一步。
- fixture 是缓存的；重新 `extract --force` 可能得到不同的候选。

## 文件

```text
v2/labs/04-user-memory/
├── fixtures/pet-clinic-memory-gemma4.json   # gemma4 抽取结果
├── runs/pet-clinic-memory/2026-10-21/       # 去重/检索结果
└── src/
    ├── domain/memory-scenario.ts            # 场景类型与校验
    ├── application/extract-candidates.ts    # 批量抽取 + 工具调用解析
    ├── application/benchmark.ts             # 去重统计 + 两种 Recall
    ├── infrastructure/ollama-chat-client.ts # Ollama /api/chat
    ├── infrastructure/fs-json-run-writer.ts
    └── tools/generate-scenario.ts           # 场景生成器
```
