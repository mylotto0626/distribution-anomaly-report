# 유통 판매 이상 탐지 시스템

유통 채널 판매 데이터에서 이상을 자동으로 탐지하고, Markdown 리포트와 웹 대시보드로 결과를 제공합니다.

---

## 빠른 시작

### 1. 의존성 설치

```bash
pip install pandas matplotlib
```

### 2. 분석 실행

```bash
python main.py
```

한 번 실행으로 아래 전체가 자동 생성됩니다.

| 결과물 | 위치 |
|--------|------|
| 전처리 데이터 | `data/processed/sales_processed.csv` |
| 이상 탐지 결과 | `data/processed/anomaly_result.csv` |
| Markdown 리포트 | `output/reports/daily_report.md` |
| 차트 5개 | `output/charts/*.png` |
| 대시보드 JSON | `output/dashboard_data.json` |
| 대시보드 데이터 | `dashboard/public/dashboard_data.json` |

---

## 대시보드 로컬 실행

### 1. 패키지 설치 (최초 1회)

```bash
cd dashboard
npm install
```

### 2. 개발 서버 실행

```bash
cd dashboard
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

---

## Vercel 배포

### 1. 데이터 최신화 후 커밋

```bash
python main.py                         # JSON 재생성
git add dashboard/public/dashboard_data.json
git commit -m "update dashboard data"
git push
```

### 2. Vercel 프로젝트 설정

| 항목 | 값 |
|------|----|
| Framework Preset | Next.js |
| Root Directory | `dashboard` |
| Build Command | `npm run build` (기본값) |
| Output Directory | `.next` (기본값) |

> Vercel 대시보드 → 프로젝트 → Settings → General → Root Directory 를 `dashboard` 로 지정하세요.

### 3. 배포

Root Directory 설정 후 `git push` 하면 Vercel이 자동으로 빌드·배포합니다.

---

## 프로젝트 구조

```
distribution-anomaly-report/
├── main.py                          # 전체 파이프라인 실행 진입점
├── data/
│   ├── raw/sales_sample.csv         # 원본 샘플 데이터 (30일 × 10개 상품)
│   └── processed/                   # 전처리·탐지 결과 (자동 생성)
├── output/
│   ├── charts/                      # 차트 5개 (자동 생성)
│   └── reports/daily_report.md      # Markdown 리포트 (자동 생성)
├── tools/
│   ├── preprocess_sales.py          # 1단계: 데이터 전처리
│   ├── detect_anomaly.py            # 2단계: 이상 탐지 (z-score 기반)
│   ├── generate_report.py           # 3단계: Markdown 리포트 생성
│   ├── visualize.py                 # 4단계: 차트 생성
│   └── export_dashboard_data.py     # 5단계: 대시보드 JSON 내보내기
├── dashboard/                       # Next.js 대시보드 (Vercel 배포용)
│   ├── public/dashboard_data.json   # 대시보드 데이터 (python main.py 로 갱신)
│   └── src/app/                     # 페이지·컴포넌트
└── workflows/                       # 업무 매뉴얼
```

---

## 탐지 유형

| 유형 | 설명 |
|------|------|
| `sales_spike` | 판매 급증 (z-score ≥ 2.0) |
| `sales_drop` | 판매 급감 (z-score ≤ −2.0) |
| `out_of_stock` | 재고 소진 (stock = 0) |
| `stockout_risk` | 재고 부족 위험 (잔여 재고 ≤ 3일치) |
| `no_sales_with_stock` | 재고 있는데 판매 없음 |

---

## 운영형 대시보드 (Supabase 연동)

상품 등록, 판매/재고 입력, CSV 업로드, 이상 탐지 실행을 웹에서 직접 처리하는 운영 모드입니다.

### 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) → 새 프로젝트 생성
2. **SQL Editor** → `supabase/schema.sql` 전체 내용 실행
3. **Project Settings → API** 에서 값 복사

### 2. 환경 변수 설정

```bash
cp dashboard/.env.local.example dashboard/.env.local
```

`.env.local` 파일을 열고 아래 두 값 입력:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. 로컬 실행

```bash
cd dashboard
npm install
npm run dev
```

### 4. Vercel 배포 시 환경 변수 추가

Vercel 프로젝트 → **Settings → Environment Variables** 에서  
`NEXT_PUBLIC_SUPABASE_URL` 과 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 를 추가합니다.

### 사용 방법

| 메뉴 | 기능 |
|------|------|
| 대시보드 | 요약 카드, 차트, 이상 탐지 결과 확인 |
| 상품 관리 | 상품 등록 및 목록 조회 |
| 판매/재고 입력 | 날짜별 판매량·재고량 직접 입력 또는 CSV 업로드 |
| 이상 탐지 실행 & 저장 | 버튼 클릭 → 탐지 결과를 DB에 저장 |

CSV 업로드 형식: `date, product_id, sales_qty, stock_qty`

---

## 데이터 교체 방법

`data/raw/sales_sample.csv` 파일을 실제 데이터로 교체한 뒤 `python main.py` 를 다시 실행하세요.  
컬럼 형식: `date, product_id, product_name, category, region, sales_qty, stock_qty, unit_price`
