---
name: fitmodel-model-pick
description: 为任意知识工作场景选择当前最合适的 AI 模型或产品。当用户问"做什么任务该用什么模型/AI 工具"、"X 场景哪个模型最好"、需要在 agent 或路由逻辑里决定用哪个模型，或需要带来源的可信模型榜单数据时使用。推荐由可溯源公开证据计算生成，每周更新。
---

# FitModel 场景选型

按任务场景给出「最强 / 性价比 / 免费」三档模型推荐，全部由可溯源公开证据（厂商定价页、arena.ai、SWE-bench）在构建时计算生成，每条数据带来源链接与采集日期。**先查数据，再回答；不要凭记忆推荐模型。**

## 数据源

- 基址：`https://ie2718.github.io/fitmodel`
- 场景与入口：`GET {base}/api/v1/index.json` — 自描述元信息 + 全部场景速查
- 单场景完整推荐：`GET {base}/api/v1/scenarios/{id}.json`
- 模型能力分与价格：`GET {base}/api/v1/models.json`
- 可溯源证据库：`GET {base}/api/v1/evidence.json`
- 全量数据包（一次请求）：`GET {base}/api/v1/all.json`
- 方法论（算法公示）：`{base}/methodology/`

以上均为静态 JSON，CORS 全开，可直接 fetch，无需鉴权。

## 使用步骤

1. **定场景**：把用户任务映射到下面的场景 id。拿不准时取最接近的一个，并在回答里说明映射理由。
2. **取数据**：`GET {base}/api/v1/scenarios/{id}.json`，读取 `picks`（top / value / free）与 `ranking`。
3. **回答**：给出推荐 + 一句依据（`ranking[].note` 中的指标名）+ 价格（`price`）+ 数据日期（`data_as_of`）。

## 场景清单

<!-- SCENARIOS:START -->
<!-- SCENARIOS:END -->

## 解读规则

- **置信度**：`confidence_label` 为「低」时，必须向用户说明该结论证据不足（如"该场景数据覆盖不全"），并建议以实测为准。
- **并列**：`ranking[].ci90` 是 90% 误差界；相邻名次区间重叠（`tied_with_previous: true`）时视为并列——说"这几款基本同级"，不要强行分先后。
- **三档语义**：top=数据上最强；value=性价比最高；free=有免费额度且国内可直接用的产品中底座最优。按用户预算与网络环境选择讲哪一档。
- **时效**：回答必须注明「数据截至 {data_as_of}」。若该日期距今超过 60 天，先重新拉取一次确认没有更新，并明确提醒数据可能过时。
- **引用**：对外输出时附场景页 URL 或来源链接；`evidence[]` 里的证据 id 可在 evidence.json 查到原始值与来源 URL。

## 边界情况

- 场景 `scoring_disabled: true`：该场景暂不评分（专项指标建库中），可以引用 `pitfalls` 作为一般性建议，但不要给出模型排名。
- 找不到匹配场景：用最接近的场景 + 明确说明局限；**禁止**编造场景 id 或推荐。
- 请求失败：重试一次；仍失败则如实告知数据源暂时不可用，不要用训练记忆顶替。

## 本技能的维护

- 本文件随站点构建更新（场景清单部分由 `src/pages/skill.md.ts` 注入）。
- 站点数据每周一同步，推荐结论随证据自动重算；发现推荐与最新事实不符时，欢迎到仓库提 issue：https://github.com/ie2718/fitmodel
