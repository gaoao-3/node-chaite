# Chaite Agent Console (web-next)

高质感的 Chaite 智能体控制台：多端会话侧边栏、SSE 实时对话工作台、Fusion 协同看板、自进化 4 维门禁与跨会话安全审批。

## 技术栈

- Next.js 16 + React 19（App Router）
- Tailwind CSS v4（Turbopack loader）
- shadcn 设计 token 思路：细边框、毛玻璃、深色墨黑 + 微光紫/青灰
- react-markdown + remark-gfm（代码块、表格、列表）
- 零额外 UI 依赖，图标使用 lucide-react

## 启动

```bash
pnpm install
pnpm dev      # http://localhost:3000，/api/* 反代到 127.0.0.1:3200
pnpm build
pnpm start
```

后端需运行在 `http://127.0.0.1:3200`（`next.config.ts` 已配置 rewrites）。

## 登录与凭据

- 首次进入会显示口令登录页，默认口令：`admin123456`。
- 前端调用 `POST /api/auth/login` 换取 JWT，存入 `localStorage` 的 `chaite.console.token`。
- 所有 REST 与 SSE 请求携带 `Authorization: Bearer <JWT>`；401 会自动回到登录页。
- SSE 使用 `fetch` ReadableStream（因为原生 EventSource 无法设置 Authorization 头），支持 `Last-Event-ID` / `since` 断线续传。

## 页面模块

| 视图 | 说明 |
| --- | --- |
| 对话工作台 | 用户 / Agent 消息、可折叠思考过程、工具调用卡片、Markdown 正文、嵌入消息流的审批卡片、SSE 状态、停止生成 |
| Fusion 协同 | 主副手拓扑、任务队列、状态推进、评审信息 |
| 自进化熔炉 | 4 维雷达图、75% 门禁、候选轨迹评审与技能熔铸 |
| 安全审批 | 跨会话聚合 pending approvals、风险筛选、分级策略说明 |
| 设置 | 连接信息、界面密度、减少动效、自动滚动、设计预览、默认平台、凭据管理 |

## 本地设计预览

设置中开启「对话设计预览」后，消息流会加载 `src/lib/demo.ts` 的静态示例，便于在没有真实事件时审阅思考、工具与审批卡片。预览不会向后端写入任何数据。

## 目录

```
src/
  app/                  App Router 入口与全局样式
  components/
    chat/               对话工作台与消息卡片
    boards/             Fusion / Evolution / Approval / Settings
    ui/                 Button、Modal、CopyButton 等基础组件
  hooks/
    use-agent-session.ts  SSE 消费、时间线归并、prompt/cancel/approval
    use-sessions.ts       会话列表与轮询
    use-approvals-feed.ts 跨会话审批聚合
    use-boards.ts         Fusion / Evolution 数据
    use-preferences.ts    本地偏好
  lib/
    api.ts              REST 客户端与鉴权
    timeline.ts         事件 → 时间线 reducer
    types.ts            Wire types
    platform.ts         平台 / 状态 / 风险元数据
```
