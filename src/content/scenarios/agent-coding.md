---
title: Agent 式复杂工程
category: coding
summary: 自主多步任务（跨文件修改、大型重构）——编码为主，长上下文与工具调用稳定性权重高。
status: draft
last_verified: 2026-08-15
dimensions:
  - { id: coding, weight: 0.6 }
  - { id: general, weight: 0.25 }
  - { id: long_context, weight: 0.15 }
pitfalls:
  - Agent 的上限取决于任务拆解：说清「改什么、验收标准是什么」远好于「帮我优化一下」。
  - 成本随自主轮次膨胀：先在小任务上校准，再放开长任务。
  - 提交前人工 review 是底线——Agent 会自信地写出看似正确的错误代码。
---

Agent 编程是变化最快的场景，本页排名有效期最短，请关注页首的验证日期与更新日志。

方法论层面稳定不变的结论只有一条：任务定义越清晰，Agent 表现越好。任务级基准（SWE-bench）证据补齐后，本页的编码维度将从「人类偏好」切换为「真实任务完成率」为主。
