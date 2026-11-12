# agent-labs

一组 AI Agent 工程实验的记录：**可复用引擎 + 独立实验 + 合成数据**。
每一个实验都自带可重跑的数据、可指回原始输出的指标，以及失败记录——"测不出来"本身也是结论。

## 目录

```text
agent-labs/
├── packages/          # 可复用引擎，不知道具体场景
│   ├── core-retrieval/   tokenizer、BM25、dense、fusion、rerank、metrics
│   ├── core-llm/         Ollama 客户端（chat / embedding）
│   ├── core-scenario/    场景模型、校验、加载
│   ├── core-eval/        评估用例、结果写入
│   └── core-memory/      记忆去重、检索、存储
├── labs/              # 每篇实验，只写这一篇的逻辑
│   ├── 01-retrieval-pipeline/   五种检索方法对比（词项 / BM25 / dense / hybrid / rerank）
│   ├── 02-sparse-bm25/          BM25 分词、倒排索引、打分
│   ├── 03-dense-ann/            Exact / ANNOY / HNSW 近邻对比
│   └── 04-user-memory/          ADD-only 用户记忆：重复堆积、规则去重、检索回归
└── scenarios/         # 全部合成数据，按场景分目录
    ├── property-notice/      试点：30 篇 / 18 条，冻结
    ├── property-notice-60/   检索主数据集：60 篇 / 30 条
    └── pet-clinic-memory/    记忆主数据集：5 用户 × 30 轮 / 40 事实 / 30 查询
```

## 依赖方向

```text
labs ──> packages
packages/core-eval     ──> core-retrieval
                       └─> core-scenario
packages/core-llm       （无内部依赖）
packages/core-memory    （无内部依赖）
labs/04-user-memory     ──> core-memory
```

`packages` 不依赖 `labs`，也不读 `scenarios` 的具体内容。
`scenarios` 只有数据，没有可执行代码。

## 快速开始

环境：Node 22+，本地 Ollama（lab-01 需要 embedding 模型，lab-04 需要 chat 模型；lab-02 纯离线）。

```bash
npm install

npm run typecheck

npm run -w @agentlab/lab-01-retrieval-pipeline eval    # 五种检索方法对比
npm run -w @agentlab/lab-02-sparse-bm25 demo           # BM25 分词 / 倒排 / 打分
npm run -w @agentlab/lab-03-dense-ann compare          # Exact / ANNOY / HNSW
npm run -w @agentlab/lab-04-user-memory benchmark      # 用户记忆去重 / Recall
npm run -w @agentlab/lab-04-user-memory extract        # 本地模型抽取，需要 Ollama
```

## 数据说明

- 所有场景数据（人物、宠物、公告、对话）均为程序合成的虚构内容，不含任何真实个人信息。
- 每个 lab 的指标都可以指回 `labs/*/runs/` 下的原始输出（该目录不入库，重新运行即可再生）；
  抽取用的 fixture 入库，便于离线复现 `benchmark`。
- 实验记录里保留失败样本和未达预期的结果。

## License

MIT
