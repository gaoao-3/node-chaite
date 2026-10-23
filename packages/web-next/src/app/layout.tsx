import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chaite Agent · 智能体控制台",
  description:
    "多端智能体会话、SSE 实时事件流、Fusion 主副手协同与自进化技能熔炉的统一控制台。",
  applicationName: "Chaite Agent",
  keywords: ["Chaite", "Agent", "SSE", "Fusion", "Self-Evolution", "控制台"],
};

export const viewport: Viewport = {
  themeColor: "#07070a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem("chaite.console.preferences")||"{}");var t=p.theme||"slate";document.documentElement.dataset.theme=t;if(["light","mist","sand","rose"].indexOf(t)>=0){document.documentElement.classList.remove("dark")}else{document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="relative h-full overflow-hidden">{children}</body>
    </html>
  );
}
