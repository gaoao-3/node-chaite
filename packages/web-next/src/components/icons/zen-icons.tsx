"use client";

import * as React from "react";

export interface ZenIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THINKING LEVEL ICONS (Precision Geometrical Apertures)
   ═══════════════════════════════════════════════════════════════════════════ */

/** None: 空心微圆 —— 静默之圆，未激活的思考 */
export const ThinkingNoneIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.6" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.4" />
  </svg>
);

/** Low: 四分之一圆弧点亮 —— 初醒之弧 (25%) */
export const ThinkingLowIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    <path
      d="M12 5A7 7 0 0 1 19 12L12 12Z"
      fill="currentColor"
    />
  </svg>
);

/** Medium: 半圆阴阳点亮 —— 平衡之半 (50%) */
export const ThinkingMediumIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M12 5A7 7 0 0 1 12 19V5Z"
      fill="currentColor"
    />
  </svg>
);

/** High: 四分之三圆弧点亮 —— 充盈之缺 (75%) */
export const ThinkingHighIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M12 5A7 7 0 1 1 5 12L12 12Z"
      fill="currentColor"
    />
  </svg>
);

/** Max: 全实心点亮 + 极简四向星芒 —— 极限满血 (100%) */
export const ThinkingMaxIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <circle cx="12" cy="12" r="6" fill="currentColor" />
    <circle cx="12" cy="12" r="2" fill="var(--bg, #090a0f)" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════════
   TOKEN, CACHE & PERFORMANCE METRIC ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

/** TokenCoinIcon: 极简几何 Token 金币徽标 */
export const TokenCoinIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <ellipse cx="12" cy="7" rx="8" ry="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 7v5c0 2.21 3.58 4 8 4s8-1.79 8-4V7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 12v5c0 2.21 3.58 4 8 4s8-1.79 8-4v-5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** CacheLightningIcon: 缓存命中闪电雷电徽标 */
export const CacheLightningIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M13 2L4 13.5H12L11 22L20 10.5H12L13 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.15"
    />
  </svg>
);

/** SparkleAiIcon: 璀璨智能微星 */
export const SparkleAiIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 3C12 7.97 7.97 12 3 12C7.97 12 12 16.03 12 21C12 16.03 16.03 12 21 12C16.03 12 12 7.97 12 3Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.2"
    />
  </svg>
);

/** SendArrowIcon: 极致克制纯净向上发送箭头 */
export const SendArrowIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 19V5M12 5L6 11M12 5L18 11"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** PlusAttachmentIcon: 极简精准附件加号 */
export const PlusAttachmentIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 5V19M5 12H19"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

/** CpuChipIcon: 现代高精度微芯片 */
export const CpuChipIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect x="5" y="5" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1" />
    <path d="M9 2V5M15 2V5M9 19V22M15 19V22M2 9H5M2 15H5M19 9H22M19 15H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** GlobeWireIcon: 极简经纬线地球仪 */
export const GlobeWireIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
    <ellipse cx="12" cy="12" rx="3.5" ry="8" stroke="currentColor" strokeWidth="1.2" opacity="0.8" />
    <path d="M4.5 12H19.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════════
   TIMELINE SPINES & STATUS ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

/** SpineRunning: 带微脉冲骨架 —— 呼吸中的执行 */
export const SpineRunningIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 4V8M12 16V20M4 12H8M16 12H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

/** SpineSuccess: 极细精准对勾 —— 确认之痕 */
export const SpineSuccessIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M5 12.5L9.5 17L19 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** SpineError: 极简对角叉 —— 终止之纹 */
export const SpineErrorIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

/** SpineApproval: 盾牌加锁警示 —— 守护之印 */
export const SpineApprovalIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 3L19 6V11.5C19 15.8 16 19.4 12 20.5C8 19.4 5 15.8 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M12 9V12M12 15V15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/** InstrumentToggle: 三柱分栏仪器台切换 */
export const InstrumentToggleIcon: React.FC<ZenIconProps> = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 4V20M16 4V20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
  </svg>
);

/** HashlineCode: 双哈希井号代码编辑符号 */
export const HashlineCodeIcon: React.FC<ZenIconProps> = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M9 4L7 20M17 4L15 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 8.5H20M3 15.5H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
