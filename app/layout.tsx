import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "하이라이툰 | 웹툰을 쇼츠처럼",
  applicationName: "하이라이툰",
  description: "하이라이툰 — 가로로 작품을 넘기고 세로로 다음 컷을 보는 모바일 웹툰 앱",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
