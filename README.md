# 🤖 Chaite-Agent (Platform)

> **The headless, progressive, microkernel Agent runtime for modern chat bots & beyond.**

`chaite-agent` 是一个高扩展、面向多平台（QQBot / DSH Mobile / Web / Telegram）的无头（Headless）智能体运行平台。
基于 `node-chaite` 的多模型协议底座，深度融入 **Pi Agent（渐进式 Tool/Skill 分层）**、**Devin / OpenCode Fusion（主副手双星协同）**、**Hermes & nekocode（4维门禁闭环自进化熔炉）** 与 **进程隔离的多端适配网关**。

---

## ✨ 核心特性

- **🧠 极致抹平的多模型协议**：
  - Claude Adaptive Thinking 思考签名无损保留
  - OpenAI 推理模型兼容与 Token 预算自适应
  - Gemini 2.5 ~ 3/4 Thinking 预算与等级平滑转换
- **🚀 Fusion 双星协同模式 (Devin Sidekick Pattern)**：
  - **Main Agent (Architect)**：顶级推理模型负责需求理解、SOP 计划、严格审查（无直接执行权限）
  - **Sidekick (Executor)**：极速高性价比模型负责工具执行与产出代码补丁（Unified Diff / JSON Patch），成本降低 ~54%
- **🧬 Hermes & nekocode Skill-Forge 自进化闭环**：
  - 自动捕获复杂踩坑与自愈轨迹（Execution Traces）
  - 经由触发质量、步骤清晰度、安全完整性、区分度 **4 维评估门禁 (≥6.0/8.0)**
  - 经验自动反思并提炼为标准的 `SKILL.md`，装载入库，越用越聪明！
- **🌐 进程隔离的 QQBot / 多平台网关**：
  - 基于 OneBot v11/v12 WebSocket 与 HTTP 协议，与内核故障隔离
  - 流式转整发聚合缓冲器、防刷屏节流、群表情反应状态反馈
  - 原生挂载 **SnowLuma MCP** (200+ QQ社交能力) 与 **Open-WebSearch MCP** (全网实时检索)
- **🛡️ Human-in-the-Loop 实时安全审批门禁**：
  - 拦截高危 Shell 命令、配置篡改与不可逆副作用
  - 联动 Web 控制台与 DSH Mobile 远程一键审批

---

## 🏗️ 架构拓扑

```
                         ┌───────────────────────────────────────┐
                         │         外部多端生态接入层            │
                         │    QQBot / DSH Mobile / Web / TG      │
                         └───────────────────┬───────────────────┘
                                             │ 标准 IPC / WebSocket (进程隔离)
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Chaite Agent Core (无头纯净内核)                                  │
│                                                                                        │
│   ┌────────────────────┐    Dispatch     ┌─────────────────────────────────────────┐   │
│   │  Session & Desk    │ ──────────────> │             AgentLoop 状态机            │   │
│   │ (工作台上下文管理)  │                 │ (单轮对话 / 多步规划 / 熔断拦截器)       │   │
│   └────────────────────┘                 └────────────────────┬────────────────────┘   │
│                                                               │                        │
│             ┌─────────────────────────────────────────────────┼──────────────────┐     │
│             ▼                                                 ▼                  ▼     │
│   ┌────────────────────┐                            ┌───────────────────┐ ┌──────────┐ │
│   │    LLM Adapters    │                            │    Tool Hub       │ │Skill Hub │ │
│   │ (OpenAI/Claude/    │                            │ (MCP / Sandbox /  │ │(SKILL.md │ │
│   │  Gemini 协议层)    │                            │  Local / Remote)  │ │按需加载) │ │
│   └────────────────────┘                            └───────────────────┘ └──────────┘ │
└───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                │ Execution Trace (执行轨迹流)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   Hermes Closed Learning Loop (自进化闭环系统)                          │
│                                                                                        │
│  [Trace 收集器] ──> [反思分析器 (Synthesizer)] ──> [AutoMerge / 老师审批门禁] ──> [更新技能]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速启动

### 1. 安装依赖与构建
```bash
pnpm install
pnpm run build
```

### 2. 启动进程隔离的 QQ 适配网关
```bash
npx tsx src/gateway/qq/onebot-adapter.ts
```

### 3. 打开 Web 控制台
```bash
cd frontend && pnpm run dev
```
访问 `http://localhost:5173` 查看：
- 🚀 **Fusion 协同**：查看主副手任务分发与 Diff 审查
- 🧬 **自进化熔炉**：查看实战执行轨迹与 4 维评估打分试炼场
- 🛡️ **安全审批门禁**：查看高危操作拦截与 SHA-256 防篡改签名
- 🌐 **多端网关与 QQBot**：实时监控 OneBot、DSH 与 Web 适配器在线状态与节流统计

---

## 📜 协议与鸣谢

本项目基于 Apache-2.0 协议开源。
鸣谢开源生态：
- [ikechan8370/node-chaite](https://github.com/ikechan8370/node-chaite)
- [nekocode/skill-forge](https://github.com/nekocode)
- [NousResearch/Hermes-Agent](https://github.com/NousResearch)
- [SnowLuma OneBot](https://github.com/SnowLuma)
