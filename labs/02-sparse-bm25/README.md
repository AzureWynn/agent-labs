# 02 · 稀疏检索 BM25

纯离线，不需要 Ollama 或 API Key。

## 这个实验看什么

- 分词：中文按相邻二元组切，英文保留技术术语、编码和数字
- 倒排索引：每个查询词命中哪些文档、tf 是多少
- BM25 打分：idf、tf 饱和（k1）、文档长度归一化（b）
- 参数扫描：k1/b 改动对 Recall/MRR 的影响
- 同义词缺口：字面不重叠时，BM25 的边界在哪里

## 命令

```bash
npm run -w @book/lab-02-sparse-bm25 demo
npm run -w @book/lab-02-sparse-bm25 explain -- --query "3号楼停水"
npm run -w @book/lab-02-sparse-bm25 eval
npm run -w @book/lab-02-sparse-bm25 sweep

# Pack C 主数据集
npm run -w @book/lab-02-sparse-bm25 eval -- --scenario property-notice-60 --label sparse-bm25-60
npm run -w @book/lab-02-sparse-bm25 sweep -- --scenario property-notice-60
```

常用参数：

```bash
--scenario property-notice
--query "3号楼停水"
--top-k 5
--k 5
--k1 1.5
--b 0.75
--label sparse-bm25
--term 下水
--gap-query 污水倒灌
```

`eval` 会把原始结果写到 `runs/<scenario>/<日期>/<label>.json`；
同一场景、同一天、同一标签已存在时会报错，重跑请换 `--label`。

## 数据

- `v2/scenarios/property-notice/`：试点，30 篇物业公告/工单，18 条中文查询，冻结。
- `v2/scenarios/property-notice-60/`：Pack C 主数据集，60 篇文档，30 条查询。

## 结果

见 `v2/scenarios/property-notice/notes.md` 与 `v2/scenarios/property-notice-60/notes.md`。

试点一句话：Recall@5 对 k1/b 不敏感（全部 1.000），MRR 只在 b=0 时从 0.917 升到 0.972；
`下水道返味` 的两篇候选各命中 2 个二元组，BM25 无法区分意图。

60 篇一句话：Recall@5 0.967，MRR 0.878；b=0 时 MRR 0.950，但 `污水倒灌怎么办`
仍然 0 命中——查询和所有文档没有字面交集，调参补不上同义词缺口。

## 代码

- `@book/core-retrieval` 的 `BM25Index`：`search`、`explain`、`postingList`、`documentFrequency`、`idf`
- `src/application/sweep.ts`：k1/b 网格与最优行选择
- `src/main.ts`：`demo` / `explain` / `eval` / `sweep` 四个模式
