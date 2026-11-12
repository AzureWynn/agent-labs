# Lab 01 · 五种检索方法对比

纯离线（embedding 查询需要 Ollama，语料侧向量可离线生成）。默认场景：`property-notice`（60 篇 / 30 条查询）。

## 这个实验看什么

同一份语料上跑五种方法，比较 Top-k（默认 k=3）命中：

1. 词项匹配（tokenizer 分词后做子串/词项命中）
2. BM25
3. dense（nomic-embed-text 余弦相似度）
4. hybrid（BM25 + dense 归一化融合）
5. rerank（hybrid 召回候选池后按最大相似度重排）

## 运行

```bash
npm run -w @agentlab/lab-01-retrieval-pipeline eval
# 可选参数：--scenario property-notice-60 --k 5 --candidate-pool 15 --label my-run
```

结果写入 `runs/<scenario>/<日期>/<label>.json`，含每个查询的命中明细与 Recall/MRR 汇总。
