# 📦 유통 판매 이상 탐지 시스템

> 유통 현장의 판매 데이터를 분석해 이상 신호를 자동으로 감지하고,  
> 운영 대시보드와 일일 리포트를 생성하는 데이터 파이프라인 시스템

---

## ✨ 핵심 특징

| 특징 | 설명 |
|------|------|
| 🔍 **판매 이상 탐지** | z-score 기반으로 판매 급증·급감을 자동 감지 |
| 📉 **재고 부족 위험 분석** | `days_of_stock` 계산으로 품절 예상 시점 사전 파악 |
| 💸 **예상 매출 손실 계산** | 재고 이슈 상품의 하루 기준 손실액 자동 산출 |
| 📊 **운영형 대시보드** | Next.js 기반 실시간 대시보드 (Vercel 배포) |
| 📄 **자동 리포트 생성** | Markdown 리포트 + 5종 시각화 차트 자동 생성 |

---

## 📋 프로젝트 개요

유통 판매 데이터(일별 판매량, 재고, 단가)를 입력받아 5단계 파이프라인을 실행합니다.

```
데이터 전처리 → 이상 탐지 → 차트 생성 → 리포트 작성 → 대시보드 내보내기
```

분석 결과는 Markdown 리포트, 시각화 차트(PNG 5종), 웹 대시보드로 출력됩니다.  
`python main.py` 한 번으로 전체 파이프라인이 자동 실행됩니다.

---

## 🤔 왜 만들었는가

유통 현장에서는 매일 수십 개 상품의 판매량과 재고를 사람이 직접 확인합니다.  
이 과정에서 다음 문제가 반복됩니다.

**품절 사태** — 재고가 언제 소진될지 미리 알기 어려워 발주 타이밍을 놓칩니다.  
**잠자는 재고** — 창고에 물건이 가득한데 판매가 0인 상품을 아무도 모릅니다.  
**판매 급변 인지 지연** — 특정 상품이 갑자기 많이·적게 팔리는 것을 며칠 뒤에야 알게 됩니다.

수작업 엑셀 분석으로는 이런 신호를 적시에 잡기 어렵습니다.  
이 시스템은 **하루치 데이터를 넣으면 이상 신호 목록과 대시보드를 자동으로 생성**합니다.

---

## 🔑 주요 기능

### 판매량 이상 탐지
상품별 과거 판매 패턴을 기준으로 당일 판매량이 통계적으로 이상한지 판정합니다.

- `sales_spike` — 평균보다 크게 많이 팔린 날 (재고 소진 가속 가능성)
- `sales_drop` — 평균보다 크게 적게 팔린 날 (수요 이탈, 진열 문제 가능성)

### 재고 부족 위험 감지
현재 재고가 며칠치인지 계산해 품절 위험을 사전에 포착합니다.

- `out_of_stock` — 재고 0개 (즉시 발주 필요)
- `stockout_risk` — 3일 이내 소진 예상 (긴급 발주 검토)

### 장기 미판매 상품 탐지
- `no_sales_with_stock` — 재고가 있는데 당일 판매 0건 (할인·프로모션 검토 대상)

### 예상 매출 손실 산출
재고 이슈 상품에 대해 `일평균 판매량 × 단가` 로 하루 기준 손실액을 계산합니다.

### 자동 리포트 및 시각화
Markdown 형식 일일 리포트와 차트 5종(PNG)을 자동 생성합니다.

---

## 🧮 이상 탐지 로직

### z-score 기반 판매 이상 탐지

```python
z_score = (당일 판매량 - 상품 평균 판매량) / 표준편차
```

상품마다 판매량 분포가 다르기 때문에 단순 절댓값 비교 대신  
**상품별 통계 기반 비교**를 사용합니다.

표준편차가 0인 상품(매일 동일하게 팔리는 경우)은 z-score를 0으로 처리해 오탐을 방지합니다.

| z-score 범위 | 판정 | 의미 |
|---|---|---|
| ≥ +2.0 | `sales_spike` | 판매 급증 |
| −2.0 ~ +2.0 | 정상 | 일반적인 판매 범위 |
| ≤ −2.0 | `sales_drop` | 판매 급감 |

### days_of_stock 기반 재고 위험 탐지

```python
days_of_stock = 현재 재고 수량 / 일평균 판매량
```

재고 절대량이 많더라도 판매 속도가 빠르면 금방 소진됩니다.  
이 공식으로 **"며칠치 재고가 남았는가"** 를 직관적으로 계산합니다.

| 조건 | 판정 | 의미 |
|---|---|---|
| `stock_qty == 0` | `out_of_stock` | 현재 품절 |
| `days_of_stock ≤ 3` | `stockout_risk` | 3일 내 소진 예상 |
| 재고 > 0, 판매 = 0 | `no_sales_with_stock` | 재고 있음 + 판매 없음 |

---

## 🏗️ 시스템 구조 (Architecture)

```
[입력 데이터]
  data/raw/sales_sample.csv
  (date, product_id, product_name, category,
   region, sales_qty, stock_qty, unit_price)
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                   main.py  (파이프라인 진입점)          │
│                                                     │
│  1. preprocess_sales.py   날짜 변환, 결측값 처리       │
│         │                 revenue 컬럼 생성           │
│         ▼                                           │
│  2. detect_anomaly.py     z-score / days_of_stock   │
│         │                 4가지 이상 유형 탐지          │
│         ▼                                           │
│  3. visualize.py          차트 5종 생성 (PNG)         │
│         │                                           │
│         ▼                                           │
│  4. generate_report.py    Markdown 리포트 생성        │
│         │                                           │
│         ▼                                           │
│  5. export_dashboard.py   대시보드용 JSON 생성·복사    │
└─────────────────────────────────────────────────────┘
         │
         ├──▶ output/reports/daily_report.md
         ├──▶ output/charts/*.png  (5종)
         ├──▶ output/dashboard_data.json
         │
         ▼
┌──────────────────────────────┐
│  Next.js 대시보드              │
│  dashboard/public/           │
│  dashboard_data.json 읽기     │──▶ Vercel (정적 배포)
└──────────────────────────────┘
```

---

## 🛠️ 기술 스택

### 분석 파이프라인 (Python)

| 구분 | 기술 |
|------|------|
| 언어 | Python 3.x |
| 데이터 처리 | pandas, numpy |
| 시각화 | matplotlib |
| 머신러닝 유틸 | scikit-learn |
| 리포트 출력 | Markdown (자동 생성) |

### 대시보드 (Frontend)

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일링 | Tailwind CSS |
| 차트 | Recharts, D3.js |
| 배포 | Vercel |
| 데이터베이스 | Supabase |

---

## 📁 프로젝트 구조

```
distribution-anomaly-report/
│
├── main.py                          # 파이프라인 실행 진입점
│
├── tools/                           # 분석 로직 모듈
│   ├── preprocess_sales.py          # 1단계: 데이터 전처리
│   ├── detect_anomaly.py            # 2단계: 이상 탐지
│   ├── visualize.py                 # 3단계: 차트 5종 생성
│   ├── generate_report.py           # 4단계: Markdown 리포트 생성
│   └── export_dashboard_data.py     # 5단계: 대시보드 JSON 내보내기
│
├── workflows/                       # 업무 흐름 문서
│   └── daily_distribution_anomaly_report.md
│
├── dashboard/                       # Next.js 대시보드
│   ├── public/dashboard_data.json   # 파이프라인 실행 시 자동 갱신
│   └── src/app/
│       ├── components/
│       │   ├── SummaryCards.tsx     # 핵심 KPI 카드 (4개)
│       │   ├── DailySalesChart.tsx  # 일별 판매 추이
│       │   ├── CategoryChart.tsx    # 카테고리별 매출
│       │   ├── AnomalyTypeChart.tsx # 이상 유형별 건수
│       │   └── AnomalyTable.tsx     # 이상 탐지 상세 테이블
│       └── types.ts                 # TypeScript 타입 정의
│
├── data/
│   ├── raw/sales_sample.csv         # 원본 입력 데이터
│   └── processed/                   # 전처리·탐지 결과 (자동 생성)
│
├── output/
│   ├── charts/                      # 차트 PNG 5종 (자동 생성)
│   └── reports/daily_report.md      # Markdown 리포트 (자동 생성)
│
├── requirements.txt
└── .env                             # API 키 (gitignore 처리)
```

---

## 📊 대시보드 설명

Python 파이프라인이 생성한 `dashboard_data.json`을 읽어 렌더링합니다.  
별도 API 서버 없이 정적 JSON으로 동작하며 Vercel에 배포됩니다.

| 컴포넌트 | 내용 |
|---------|------|
| **Summary Cards** | 총 매출액 · 총 판매량 · 이상 탐지 건수 · 예상 매출 손실 (KPI 4종) |
| **Daily Sales Chart** | 분석 기간 내 일별 판매량·매출 추이 |
| **Category Chart** | 카테고리별 매출 비교 |
| **Anomaly Type Chart** | 이상 유형별 탐지 건수 분포 |
| **Anomaly Table** | 이상 항목 상세 목록 (날짜·상품·유형·손실액) |

---

## 🚀 실행 방법

### 1. 환경 준비

```bash
git clone https://github.com/your-username/distribution-anomaly-report.git
cd distribution-anomaly-report

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### 2. 데이터 준비

`data/raw/sales_sample.csv` 파일을 아래 형식으로 준비합니다.

```csv
date,product_id,product_name,category,region,sales_qty,stock_qty,unit_price
2024-01-01,P001,상품A,음료,서울,120,500,1500
2024-01-01,P002,상품B,과자,부산,0,200,2000
```

### 3. 파이프라인 실행

```bash
python main.py
```

실행 결과:

| 결과물 | 위치 |
|--------|------|
| 전처리 데이터 | `data/processed/sales_processed.csv` |
| 이상 탐지 결과 | `data/processed/anomaly_result.csv` |
| Markdown 리포트 | `output/reports/daily_report.md` |
| 차트 5종 | `output/charts/*.png` |
| 대시보드 JSON | `output/dashboard_data.json` |

### 4. 대시보드 로컬 실행

```bash
cd dashboard
npm install
npm run dev
```

`http://localhost:3000` 에서 대시보드 확인

---

## ☁️ 배포 정보

### Vercel (프론트엔드)

```bash
# 1. 파이프라인 실행 → dashboard/public/dashboard_data.json 자동 갱신
python main.py

# 2. 변경사항 커밋 후 푸시하면 Vercel 자동 배포
git add dashboard/public/dashboard_data.json
git commit -m "update dashboard data"
git push
```

**Vercel 프로젝트 설정**

| 항목 | 값 |
|------|----|
| Framework Preset | Next.js |
| Root Directory | `dashboard` |
| Build Command | `npm run build` |

### Supabase (운영형 DB 연동)

`.env` 파일에 Supabase 연결 정보를 설정합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Vercel 배포 시에는 **Settings → Environment Variables** 에 동일한 값을 추가합니다.

---

## 🔮 향후 개선 사항

- [ ] **자동화 스케줄링** — GitHub Actions cron으로 매일 자동 실행
- [ ] **슬랙·이메일 알림** — 이상 탐지 발생 시 즉시 알림 발송
- [ ] **누적 데이터 분석** — Supabase에 결과를 쌓아 기간별 추세 비교
- [ ] **적응형 임계값** — 계절성·프로모션 기간을 반영한 동적 기준값 조정
- [ ] **지역별 이상 탐지** — 카테고리·지역 조합 단위의 세분화 분석
- [ ] **판매량 예측** — Prophet 기반 예측으로 발주 시점 자동 추천

---

## 💡 프로젝트를 통해 배운 점

**통계는 맥락이 있어야 의미가 있다.**  
판매량 100개라는 숫자 자체는 정보가 없습니다. 평균이 50개인 상품의 100개와 평균이 95개인 상품의 100개는 완전히 다른 신호입니다. z-score를 도입하면서 "절댓값이 아닌 상품별 상대 편차"로 이상을 정의하는 것의 실질적 차이를 직접 확인했습니다.

**파이프라인은 각 단계가 독립적이어야 유지보수가 쉽다.**  
전처리, 탐지, 시각화, 리포트 생성을 각각 독립 모듈로 분리하니 한 단계를 수정해도 다른 단계에 영향이 없었습니다. 처음에 하나의 스크립트에 모든 로직을 넣으려 했는데, 그 방식이 얼마나 취약한지 금방 알게 됐습니다.

**운영자의 언어로 결과를 표현해야 실제로 쓰인다.**  
"z-score = 2.45"가 아니라 "이 상품, 평균보다 2.4배 더 팔렸습니다"로 바꿔 표현하는 것이 핵심이었습니다. 분석 결과가 기술 용어 그대로 출력되면 현장에서는 열어보지 않습니다.

---

<p align="center">
  <sub>판매 데이터를 넣으면, 무엇을 주의해야 하는지 알려주는 시스템</sub>
</p>
