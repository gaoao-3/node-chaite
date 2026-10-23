export const CONSOLE_VIEWS = ["chat", "fusion", "evolution", "approvals", "settings"] as const;
export type ConsoleView = (typeof CONSOLE_VIEWS)[number];

export interface ViewMeta {
  key: ConsoleView;
  label: string;
  short: string;
  description: string;
  heading: string;
  subheading: string;
}

export const VIEW_META: Record<ConsoleView, ViewMeta> = {
  chat: {
    key: "chat",
    label: "对话工作台",
    short: "Chat",
    description: "实时会话与工具事件",
    heading: "对话工作台",
    subheading: "流式思考、工具调用与人工审批共用一条时间线。",
  },
  fusion: {
    key: "fusion",
    label: "Fusion 协同",
    short: "Fusion",
    description: "主副手任务编排",
    heading: "Fusion 协同",
    subheading: "Main Agent 拆解任务，Sidekick 执行，评审门禁决定是否合流。",
  },
  evolution: {
    key: "evolution",
    label: "自进化熔炉",
    short: "Evolution",
    description: "4 维门禁技能锻造",
    heading: "自进化熔炉",
    subheading: "把成功轨迹蒸馏为可复用技能，四维评分全部越过 75% 才可熔铸。",
  },
  approvals: {
    key: "approvals",
    label: "安全审批",
    short: "Approvals",
    description: "高危操作人工确认",
    heading: "安全审批",
    subheading: "跨会话聚合待审操作，逐项确认影响范围与执行参数。",
  },
  settings: {
    key: "settings",
    label: "设置",
    short: "Settings",
    description: "连接、外观与凭据",
    heading: "设置",
    subheading: "控制连接、界面密度、演示视图与本地凭据。",
  },
};

export function isConsoleView(value: string): value is ConsoleView {
  return (CONSOLE_VIEWS as readonly string[]).includes(value);
}
