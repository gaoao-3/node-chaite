"use client";

import * as React from "react";

export interface ZenIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

/** None: 空心微圆 —— 静默之圆，未激活的思考 */
export const ThinkingNoneIcon: React.FC<ZenIconProps> = ({ size = 18, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3" />
  </svg>
);

/** Low: 四分之一圆弧点亮 —— 初醒之弧 */
export const ThinkingLowIcon: React.FC<ZenIconProps> = ({ size = 18, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 5a7 7 0 0 0-7 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.3"
    />
    <path
      d="M12 5a7 7 0 0 1 7 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

/** Medium: 半圆阴阳点亮 —— 平衡之半 */
export const ThinkingMediumIcon: React.FC<ZenIconProps> = ({ size = 18, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M5 12a7 7 0 0 1 14 0"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.3"
    />
    <path
      d="M5 12a7 7 0 0 0 14 0"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

/** High: 四分之三圆弧点亮 —— 充盈之缺 */
export const ThinkingHighIcon: React.FC<ZenIconProps> = ({ size = 18, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 5a7 7 0 1 1-7 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.3"
    />
    <path
      d="M12 5a7 7 0 1 0 7 7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

/** Max: 全实心点亮 + 极简微弱星芒外圈 —— 圆满之光 */
export const ThinkingMaxIcon: React.FC<ZenIconProps> = ({ size = 18, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    <circle cx="12" cy="12" r="7" fill="currentColor" />
    <circle cx="12" cy="12" r="2.5" fill="var(--bg, #0b0b11)" />
  </svg>
);

/** SpineRunning: 带微脉冲骨架 —— 呼吸中的执行 */
export const SpineRunningIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 3v4M12 11v2M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" opacity="0.6">
      <animate attributeName="r" values="2;3.2;2" dur="1.6s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.6s" repeatCount="indefinite" />
    </circle>
  </svg>
);

/** SpineSuccess: 极细精准对勾 —— 确认之痕 */
export const SpineSuccessIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M6 12.5l4 4L18 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** SpineError: 极简对角叉 —— 终止之纹 */
export const SpineErrorIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** SpineApproval: 盾牌加锁警示 —— 守护之印 */
export const SpineApprovalIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 3l7 3v5c0 4.418-3.134 8-7 9-3.866-1-7-4.582-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M12 10v2M12 16v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** InstrumentToggle: 三柱分栏仪器台切换 */
export const InstrumentToggleIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 4v16M16 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** HashlineCode: 双哈希井号代码编辑符号 */
export const HashlineCodeIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M9 5L7 19M17 5l-2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 9h16M3 15h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
