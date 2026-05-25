-- ============================================================
-- 유통 판매 이상 탐지 시스템 — Supabase 테이블 설계
-- Supabase 대시보드 > SQL Editor 에서 전체 실행
-- ============================================================

-- 1. 상품 정보
CREATE TABLE IF NOT EXISTS products (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   TEXT        NOT NULL UNIQUE,
  product_name TEXT        NOT NULL,
  category     TEXT        NOT NULL,
  region       TEXT        NOT NULL,
  unit_price   INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 일별 판매/재고
CREATE TABLE IF NOT EXISTS daily_sales (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE    NOT NULL,
  product_id TEXT    NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  sales_qty  INTEGER NOT NULL DEFAULT 0,
  stock_qty  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, product_id)
);

-- 3. 이상 탐지 결과
CREATE TABLE IF NOT EXISTS anomaly_results (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  analyzed_at          TIMESTAMPTZ DEFAULT NOW(),
  date                 DATE        NOT NULL,
  product_id           TEXT        NOT NULL,
  product_name         TEXT        NOT NULL,
  category             TEXT        NOT NULL,
  anomaly_type         TEXT        NOT NULL,
  anomaly_label        TEXT        NOT NULL,
  value                INTEGER,
  z_score              NUMERIC,
  days_of_stock        NUMERIC,
  avg_daily_sales      NUMERIC,
  estimated_lost_sales INTEGER     DEFAULT 0,
  detail               TEXT
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_sales_date       ON daily_sales(date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_product_id ON daily_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_results_date   ON anomaly_results(date);

-- RLS 비활성화 (MVP — 로그인 없음)
ALTER TABLE products        DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales     DISABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_results DISABLE ROW LEVEL SECURITY;
