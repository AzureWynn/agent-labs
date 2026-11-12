# 03 · 稠密检索与 ANN 索引

对比精确搜索、ANNOY（随机投影树）和 HNSW（分层图）。

## 这个实验看什么

- 精确搜索作为召回基准：遍历全部向量算余弦相似度。
- ANN 索引的建索引成本、单查询延迟、相对精确搜索的召回率。
- `n_trees`（ANNOY）和 `ef_search`（HNSW）如何影响召回。
- 区分两类误差：表示误差（嵌入模型）和近似搜索误差（索引）。

## 命令

```bash
# 真实场景：60 篇文档、30 条查询、768 维
npm run -w @book/lab-03-dense-ann compare -- --scenario property-notice-60 --k 10 --label dense-ann-compare-60

# 合成向量：5,000 条、768 维、30 条查询
npm run -w @book/lab-03-dense-ann stress -- --docs 5000 --dim 768 --queries 30 --k 10 --label dense-ann-stress-5k-768

# 参数扫描
npm run -w @book/lab-03-dense-ann sweep -- --docs 5000 --dim 768 --queries 30 --k 10 --label dense-ann-sweep-5k-768
```

`compare` 需要本地 Ollama 和 `nomic-embed-text`；`stress` / `sweep` 不调用模型。

常用参数：

```bash
--scenario property-notice-60
--k 10
--docs 5000
--dim 768
--queries 30
--clusters 50
--noise 0.15
--seed 42
--n-trees 50
--M 16
--ef-construction 200
--ef-search 50
--label dense-ann-compare
```

输出写到 `runs/<scenario>/<日期>/<label>.json`；同一场景、同一天、同一标签已存在时报错，
重跑请换 `--label`。

## 数据

- 真实场景：`v2/scenarios/property-notice-60/`，60 篇文档、30 条查询。
- 合成向量：`createSyntheticVectors` 用固定种子生成 50 个簇，每簇内加噪声；
  只用于测索引，不代表嵌入质量。

## 结果

### 真实场景（60 篇，768 维，k=10）

| 索引 | 建索引(ms) | 单查询(ms) | Recall@10 | miss |
| --- | --- | --- | --- | --- |
| Exact | 0.06 | 0.059 | 1.000 | 0 |
| ANNOY | 1.44 | 0.049 | 1.000 | 0 |
| HNSW | 20.40 | 0.162 | 1.000 | 0 |

60 篇文档太小，三个索引的召回都是 100%。精确搜索单查询 0.059ms，已经比 HNSW 快；
ANNOY 略快一点，但建索引多花 1.4ms。这个规模下没有理由上 ANN。

### 合成向量（5,000 条，768 维，30 条查询，k=10）

| 索引 | 建索引(ms) | 单查询(ms) | Recall@10 | miss |
| --- | --- | --- | --- | --- |
| Exact | 0.20 | 15.405 | 1.000 | 0 |
| ANNOY | 465.18 | 0.301 | 0.887 | 27 |
| HNSW | 16,754.10 | 0.489 | 0.993 | 2 |

5,000 条、768 维时，精确搜索单查询 15.4ms。ANNOY 快 51 倍，但 30 条查询里有 27 条没找全；
HNSW 快 31 倍，召回 0.993，但建索引 16.8 秒，是 ANNOY 的 36 倍。

### 参数扫描（5,000 条，768 维，k=10）

ANNOY 的 `n_trees` 从 1 到 50，Recall@10 都是 0.887：

| n_trees | Recall@10 | miss |
| --- | --- | --- |
| 1 | 0.887 | 27 |
| 2 | 0.887 | 27 |
| 5 | 0.887 | 27 |
| 10 | 0.887 | 27 |
| 50 | 0.887 | 27 |

HNSW 的 `ef_search` 要到 50 才把召回拉到 0.993：

| ef_search | Recall@10 | miss |
| --- | --- | --- |
| 1 | 0.820 | 22 |
| 2 | 0.813 | 24 |
| 5 | 0.807 | 23 |
| 10 | 0.827 | 24 |
| 50 | 0.993 | 2 |

这组数据说明 ANN 不是"免费的加速"：ANNOY 用更低的建索引成本换到 51 倍查询加速，
但召回停在 0.887；HNSW 用 36 倍建索引成本换到 0.993，查询还比 ANNOY 慢一些。
参数继续调，也只是在"更快"和"更准"之间移动。

## 关键结论

1. 小数据（几十到几百条）上，精确搜索已经足够快，ANN 的建索引成本不划算。
2. 数据变大后，ANN 的收益才出现；但收益大小取决于索引类型和参数。
3. ANN 的 Recall 是"相对精确搜索"的召回，不是"相对答案"的召回。
   真实场景里 ANN Recall@10 是 1.000，但 Dense 相对标注的 Recall@5 只有 0.7333；
   前者说明索引没丢结果，后者说明嵌入模型本身没找对。
4. HNSW 是随机算法，每次运行的数字会有小幅波动；ANNOY 也不是确定性的。

## 代码

- `src/application/vector-index.ts`：`VectorIndex` 端口、向量维度校验
- `src/application/benchmark.ts`：精确 top-k、召回计算、建索引/查询计时
- `src/application/synthetic-vectors.ts`：固定种子的分簇向量
- `src/infrastructure/exact-index.ts`：精确搜索
- `src/infrastructure/annoy-index.ts`：ANNOY 封装（`createRequire`）
- `src/infrastructure/hnsw-index.ts`：HNSW 封装（`addPoint` 是 async）
- `src/infrastructure/fs-json-run-writer.ts`：不覆盖的 JSON 结果写入
- `src/main.ts`：`compare` / `stress` / `sweep` 组合根

## 注意

- `annoy` 是 CJS 原生模块，ESM 下用 `createRequire`，模块直接导出构造函数。
- `hnsw` 的 `addPoint` 是 async，必须 `await`。
- 合成向量只测索引行为，不代表真实嵌入的分布；真实结论看 `compare`。
