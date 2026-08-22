---
title: 代码审查与调试
category: coding
summary: 读代码比写代码更考验细粒度理解——编码能力为主，长上下文影响大片段输入。
status: draft
last_verified: 2026-08-15
dimensions:
  - { id: coding, weight: 0.6 }
  - { id: general, weight: 0.3 }
  - { id: long_context, weight: 0.1 }
pitfalls:
  - 给最小可复现场景：报错 + 相关代码 + 已试过什么，比贴整个文件有效。
  - 模型会顺着你的猜测走：描述 bug 时别带上你的结论，先让它独立判断。
  - 安全审查交给专门工具与流程，通用模型的「看起来安全」不算数。
---

调试场景有个反直觉技巧：别告诉模型你认为 bug 在哪。先客观描述现象让它独立分析，命中率反而更高——模型太「配合」，会顺着错误假设走。
