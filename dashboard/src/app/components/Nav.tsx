"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/products", label: "상품 관리" },
  { href: "/sales", label: "판매/재고 입력" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="bg-slate-800 text-white px-6 py-4 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">유통 이상 탐지</span>
        <div className="flex gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-slate-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-700"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
