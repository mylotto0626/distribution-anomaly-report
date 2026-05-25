import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/Nav";

export const metadata: Metadata = {
  title: "유통 판매 이상 탐지 대시보드",
  description: "유통 채널 판매 데이터 이상 탐지 결과 시각화 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
