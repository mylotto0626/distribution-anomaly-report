"use client";

import { useRef, useState } from "react";

export default function CSVUpload({ onSuccess }: { onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setStatus("loading");
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload-csv", { method: "POST", body: fd });
    const json = await res.json();

    if (res.ok) {
      setStatus("done");
      setMessage(`${json.inserted}건 업로드 완료`);
      if (inputRef.current) inputRef.current.value = "";
      onSuccess();
    } else {
      setStatus("error");
      setMessage(json.error ?? "업로드 실패");
    }
  };

  return (
    <form onSubmit={upload} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          CSV 컬럼 순서:{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
            date, product_id, sales_qty, stock_qty
          </code>
        </p>
        <a
          href="/csv_template.csv"
          download="csv_template.csv"
          className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900 whitespace-nowrap ml-3"
        >
          양식 다운로드
        </a>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        required
        className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
      />
      {status === "done" && <p className="text-green-600 text-sm">{message}</p>}
      {status === "error" && <p className="text-red-600 text-sm">{message}</p>}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {status === "loading" ? "업로드 중..." : "CSV 업로드"}
      </button>
    </form>
  );
}
