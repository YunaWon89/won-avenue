# WON AVENUE — 한국 음식 배달 & 포장 주문

[English](README.md) · **한국어**

한국에 있는 **모든 사람**을 위한 음식 주문 서비스입니다. 특히 외국인, 알레르기가 있는 사람, 할랄·채식·비건 식단을 지키는 사람을 위해 만들었습니다.

- 🌏 **7개 언어**: English(기본), 한국어, 中文, Tiếng Việt, ภาษาไทย, Русский, 日本語 — 한국에 사는 외국인 수가 많은 언어 순으로 골랐습니다. 사장님은 메뉴를 한국어로 쓰고, 손님은 자기 언어로 읽습니다.
- 🛂 **식단 여권**: 식단·알레르기·매운맛 정도를 한 번만 설정하면 모든 메뉴에 *나에게 안전* / *나에게 맞지 않음*이 표시됩니다. 켜고 끄는 스위치 하나로 동작하며, 끄면 표시 없이 일반 메뉴가 보입니다.
- 🧑‍🍳 한국 음식마다 **"어떤 음식인가요?"** 설명과 발음 듣기(🔊).
- 😋 **기분별 추천**: 매콤한 게 당겨요, 가볍고 상큼하게, 집밥 같은 위로, 달달한 게 필요해, 야식, 빠르게(20분 이내).
- 💳 저장한 국내·해외 카드로 **원화(KRW)** 결제, **배달 또는 포장**.
- 🛒 **장바구니 하나에 여러 가게**(최대 5곳): 결제는 한 번, 가게마다 주문·배달비·배달기사가 따로.
- 🏪 사장님은 메뉴(알레르기, 라벨, 사진, 번역)를 관리하고, 주문에서는 **주문 수락 / 거절**, **배달 출발 / 픽업 준비 완료**만 누르면 됩니다.
- 🛵 **배달기사**가 배달을 잡고 배달 완료를 표시합니다. 나머지는 모두 자동으로 진행됩니다.
- ✨ **밝은 / 어두운 골드 테마**(휴대폰 설정 따라감), 윤아 서명이 들어간 한옥 엠블럼, 작은 애니메이션: 메뉴가 금빛 반짝임과 함께 장바구니로 날아가고, 조리 중에는 꼬마 셰프들이 요리하고, 배달 중에는 배달기사가 지도 위를 달리고, 배달 완료 때 대문 앞에서 손을 흔들어요.
- 🛡️ 관리자는 가게를 승인하고, **등록된 메뉴를 사후 검수**하고, 회원과 리뷰를 관리하며, 시연 전에 **데모 데이터를 초기화**할 수 있습니다.

**기술 스택:** React 19 (Vite) · Node.js + Express 5 · PostgreSQL · httpOnly 쿠키 JWT · Zod · Jest + Supertest

---

## 주요 기능

| 영역 | 내용 |
|---|---|
| 손님 | 전화번호 + 전체 주소로 회원가입(카카오 우편번호 검색), 카드 저장, 장바구니, 결제, 실시간 주문 상태, 접수 전 취소(자동 환불), 배달기사에게 전화(배달 중 / 배달 직후), 배달 후 "어떠셨어요?" 별점 알림, 완료 후 사진(최대 3장)이 있는 리뷰, 필터가 있는 주문내역 |
| 알레르기 & 식단 | 알레르기 22종(식약처 표시 대상 + 참깨, 생선, 견과류). "이 재료가 든 메뉴 숨기기" 필터(기기에 저장). 식단 필터: 할랄, 채식, 비건, 글루텐 프리, 돼지고기 없음, 알코올 없음. 서버가 "할랄 + 돼지고기" 같은 잘못된 조합을 거부 |
| 여러 가게 장바구니 | 최대 5개 가게의 메뉴를 한 장바구니에 담고 한 번에 결제. 가게마다 별도 주문(조리, 배달비, 배달기사, 상태가 각각). 배달 / 포장은 모든 가게가 지원해야 함(예: 포장 전용 가게가 있으면 포장으로 주문). 모든 주문을 함께 검증하고, 결제가 실패하면 아무것도 남기지 않고 이미 결제된 부분은 환불 |
| 배달 / 포장 | 가게별 배달비, 최소 주문 금액, 조리 시간. 포장 주문은 별도 상태(`ready_for_pickup`) |
| 결제 | 원화, 원 단위. 빌링키로 카드 저장 — **카드 번호는 저장하지 않습니다**. 데모용 `mock`, 실제 결제용 `toss`(토스페이먼츠 자동결제) |
| 언어 | 화면 문구 7개 언어(560개 문구 모두 직접 번역). 사장님이 쓴 내용은 저장할 때 **Gemini**가 한 번 번역(메뉴에 맞춘 프롬프트, 음식 이름은 알아볼 수 있게 유지, 외국인용 "어떤 음식인가요?" 작성). 번역은 DB에 저장되고 사장님이 수정 가능(직접 고친 번역은 덮어쓰지 않음), 실패하면 자동 재시도. 데모 메뉴는 직접 번역. **손님 리뷰**도 번역: 원문 언어는 글에서 자동 감지, 읽는 사람의 언어로 보여 주고 "원문 보기" 가능 |
| 식단 여권 | 계정에 저장(비회원은 기기에 저장). 서버가 가게마다 "나에게 안전한 메뉴 N개"를 계산. 엄격한 규칙: 알레르기 재료 제외, 할랄·비건·채식은 라벨 필수, 돼지고기 없음·글루텐 프리는 재료로 확인 |
| 사장님 | 직접 가입 → 가게 등록 → 관리자 승인. 사진·알레르기·식단 라벨·매운맛·품절 표시가 있는 메뉴와 카테고리 관리. 자동 새로고침과 새 주문 알림이 있는 주문 접수 화면: **주문 수락**(→ 조리 중) 또는 **거절**, 이후 **배달 출발** / **픽업 준비 완료**. "기사 배정 대기" / "배달기사 이동 중" 표시, 관리자의 메뉴 수정 요청 확인 |
| 배달기사 | "배달" 화면: 대기 중인 배달 → **배달 잡기**(주문당 기사 한 명) → 가게 / 손님에게 전화 → **배달 완료**. 배달을 잡은 기사만 배달 완료를 표시할 수 있음 |
| 관리자 | 통계 대시보드, 회원(검색, 역할, 활성/비활성), 가게(승인, 사장님 지정, 삭제/비활성), 전체 주문(조회만, 취소 가능), 리뷰 관리, **메뉴 사후 검수** |
| 메뉴 검수 | 새 메뉴와 수정된 메뉴는 바로 공개됩니다. 관리자가 **OK** 또는 메시지와 함께 **수정 요청**을 보내면, 사장님 화면에 메시지와 **지금 수정하기** 버튼이 나타납니다. 수정하면 다시 관리자에게 돌아가고, `DISH_FIX_DAYS`(3일) 안에 수정하지 않으면 자동으로 숨겨집니다 |
| 영업시간 | 사장님이 영업시간을 설정(서울 시간, 자정 넘김 가능, 비우면 24시간). 영업 전에는 "영업 전 · 11:00 오픈"이 표시되고 주문을 받지 않음(`RESTAURANT_CLOSED`). 데모에서는 도쿄 라멘만 영업시간(11:00–21:30)이 있어 항상 열린 가게가 있어요 |
| 알림 | 사장님 주문 접수 화면과 배달기사 화면에서 새 주문 / 배달이 오면 짧은 알림음("알림음 켜짐" 버튼, 브라우저 정책상 한 번 탭 필요) |
| 개인정보 | 식단·알레르기 정보는 건강 관련 정보라 명시적 동의(`passportConsent`) 후에만 저장, 삭제하면 동의도 철회. 메뉴 표시는 "나에게 맞음"(가게 정보 기준)이며 의학적 보증이 아니라는 안내 포함 |
| 자동 처리 | 응답 없는 주문은 `AUTO_CANCEL_MINUTES` 후 자동 취소·환불. 배달 완료 / 픽업 대기 주문은 손님이 확인하지 않으면 `AUTO_COMPLETE_MINUTES` 후 자동 완료 |
| 품질 | 역할 기반 접근 제어 + 소유권 확인, 프론트·백엔드 양쪽 검증, 일관된 오류 형식, 로그인 요청 횟수 제한, Helmet CSP, API 테스트 81개, Swagger 문서 |

## 빠른 시작 (로컬)

필요 환경: Node.js 20+, PostgreSQL 14+ (또는 Docker).

```bash
# 1. 데이터베이스 (PostgreSQL이 이미 실행 중이면 건너뛰기)
docker compose up -d

# 2. 설치
npm run install:all

# 3. 설정
cp server/.env.example server/.env        # Windows: copy server\.env.example server\.env

# 4. 테이블 + 데모 데이터 생성
npm run db:reset

# 5. 실행 (터미널 두 개)
npm run dev:server     # API  -> http://localhost:5000  (문서: /api/docs)
npm run dev:client     # 앱   -> http://localhost:5173
```

Docker 없이 실행할 때는 데이터베이스 `food_delivery`(앱)와 `food_delivery_test`(테스트)를 직접 만들어 주세요.

### 데모 계정

모든 계정 비밀번호: **`Demo1234!`**

| 이메일 | 역할 |
|---|---|
| customer@demo.com | Aisha — 식단 여권(할랄, 땅콩·새우 제외), 저장된 카드, 주문내역, 조리 중 주문 1건과 배달 중 주문 1건(지도에서 배달기사가 움직이는 모습 확인)이 있는 손님 |
| owner@demo.com | 사장님(한국어 화면) — 서울 한식당, 바삭 치킨, 명동 분식 |
| owner2@demo.com | 사장님 — 이스탄불 할랄 키친, 그린보울, 달콤 디저트 카페 |
| admin@demo.com | 관리자("데모 데이터 초기화" 가능) |
| courier@demo.com | 배달기사 박민수 — 잡을 수 있는 배달 1건, 배달 중 2건 |
| minh@demo.com, olga@demo.com | 베트남어 / 러시아어로 리뷰를 남긴 손님 |

데모 카드(mock 모드): `4242 4242 4242 4242`는 결제 성공, `4000 0000 0000 0002`는 항상 거절. 유효기간은 미래 날짜, CVC는 아무 숫자.

데모 사진은 데모용으로 AI가 생성한 이미지예요(`server/src/db/demo-images`). 실제 메뉴와 맞는 경우에만 붙였어요(채식 메뉴에 고기 사진 없음). 실제 가게는 직접 사진을 올려요.

## AI 코딩 에이전트와 함께 작업하기

- `CLAUDE.md` — Claude Code가 세션마다 먼저 읽는 프로젝트 안내(스택, 명령어, 규칙).
- `docs/PRD.md` — 상태 표시가 있는 제품 요구사항(완료 / 과제와 다르게 구현 / 남은 작업).
- `.claude/skills/` — 단계별 작업 안내: `add-api-endpoint`, `add-ui-text`(7개 언어), `run-checks`.
- `.claude/settings.json` — 테스트·린트·빌드는 묻지 않고 실행, 커밋·푸시는 먼저 확인, `.env` 파일은 읽지 않음.
- `npm run check:i18n` — 7개 언어 화면 문구 파일의 키가 모두 같은지 확인.

## 테스트

```bash
npm test
```

`food_delivery_test`(실행할 때마다 초기화)에서 API 테스트 81개(Jest + Supertest): 인증, 역할별 접근, CRUD, 페이지·필터·정렬, 알레르기·식단 필터, 식단 여권, 결제, 여러 가게 주문(전부 성공 또는 전부 취소, 결제 실패 시 환불), 배달기사 배달 잡기 / 배달 완료를 포함한 전체 주문 흐름, 자동 취소 / 완료, 메뉴 사후 검수, 리뷰와 평점 재계산, 업로드, 데모 초기화, 영업시간(자정 넘김 포함), 식단 여권 동의, 오류 형식.

## 환경 변수 (`server/.env`)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | 로컬 `food_delivery` | PostgreSQL 연결 문자열 |
| `DATABASE_SSL` | `false` | 검증 가능한 인증서 없이 SSL이 필요한 호스트면 `true` |
| `JWT_SECRET` | 개발용 값 | **운영 환경에서 필수**(길고 무작위인 문자열) |
| `JWT_EXPIRES_IN` | `7d` | |
| `CLIENT_URL` | `http://localhost:5173` | 개발 환경 CORS 주소 |
| `SEED_ON_EMPTY` | `false` | `true` → 시작할 때 DB가 비어 있으면 데모 데이터 생성 |
| `GEMINI_API_KEY` | — | 새 메뉴와 리뷰 자동 번역 사용([무료 키](https://aistudio.google.com/apikey)). 없으면 새 내용은 작성한 언어 그대로 표시(데모 데이터는 이미 번역됨) |
| `GEMINI_MODEL` | `gemini-3.5-flash` | 사용할 Gemini 모델 |
| `TRANSLATION_PROVIDER` | `auto` | `auto` / `gemini` / `deepl` / `none` |
| `DEEPL_API_KEY` | — | 대체 번역 서비스 |
| `DEMO_MODE` | `false` | `true` → 관리자가 "데모 데이터 초기화" 가능 |
| `PAYMENT_PROVIDER` | `mock` | `mock` 또는 `toss` |
| `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` | — | 토스페이먼츠 키(개발에는 테스트 키 사용 가능) |
| `AUTO_CANCEL_MINUTES` | `15` | 아무도 수락하지 않은 주문은 취소·환불 |
| `AUTO_COMPLETE_MINUTES` | `10` | 배달 완료 / 픽업 대기 주문을 손님이 확인하지 않으면 완료 처리 |
| `DISH_FIX_DAYS` | `3` | 관리자 수정 요청 후 사장님이 메뉴를 고칠 수 있는 기간(일). 지나면 메뉴 숨김 |

앱을 켜지 않고 번역 키를 확인하려면: `npm run check:translation` (사용 중인 번역 서비스를 보여 주고, 테스트 요청을 한 번 보내고, 실패하면 이유를 알려 줍니다. 키는 출력하지 않아요).

## 배포 (공개 링크)

서버가 빌드된 React 앱도 함께 제공하므로, 전체 프로젝트는 **웹 서비스 1개 + 데이터베이스 1개**로 하나의 주소에서 동작합니다(같은 도메인 쿠키, CORS 설정 불필요).

### Render (무료)

1. 이 저장소를 GitHub에 올립니다.
2. Render → **New → Blueprint** → 저장소 선택. `render.yaml`이 웹 서비스와 PostgreSQL을 만듭니다.
3. 첫 배포를 기다립니다. 데모 데이터는 자동으로 추가됩니다(`SEED_ON_EMPTY=true`). `https://<서비스>.onrender.com`을 엽니다.
4. 선택: 서비스의 Environment 설정에 `GEMINI_API_KEY`를 추가하면 새 메뉴와 리뷰가 자동 번역됩니다.

무료 플랜 참고: 15분 정도 접속이 없으면 서비스가 잠들고(첫 요청에 30~60초), Render 무료 PostgreSQL은 30일 후 만료됩니다. 오래 쓸 무료 데이터베이스가 필요하면 [Neon](https://neon.tech)에서 만들고 `DATABASE_URL`에 연결 문자열을 넣으세요.

### Docker 호스트

```bash
docker build -t won-avenue .
docker run -p 5000:5000 -e DATABASE_URL=... -e JWT_SECRET=... -e SEED_ON_EMPTY=true won-avenue
```

## 실제 결제 (토스페이먼츠)

1. 토스페이먼츠 가맹점 계정을 만들고 **자동결제(빌링)** 계약을 합니다. 해외 카드 결제 가능 여부는 가맹점 계약에 포함되므로 토스에 확인하세요.
2. `PAYMENT_PROVIDER=toss`, `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`를 설정합니다.
3. 이제 "카드 추가"를 누르면 토스 결제창이 열립니다. 카드 정보는 우리 서버를 거치지 않고, 빌링키·카드사·마지막 4자리만 저장합니다. 주문은 빌링키로 결제되고, 결제된 주문을 취소하면 환불됩니다.

> 토스 연동은 공식 자동결제 API 문서를 따르지만, 실제 운영 전에 본인의 테스트 키로 반드시 확인해야 합니다.

## API

대화형 문서: **`/api/docs`** (Swagger UI). 요약:

| 메서드 | URL | 접근 권한 |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | 누구나 |
| GET / PATCH | `/api/auth/me` · POST `/api/auth/me/password` | 로그인 사용자 |
| GET | `/api/restaurants` (search, cuisine, minRating, orderType, diet, sort, page, limit) | 누구나 |
| GET | `/api/restaurants/:id` · `/:id/menu-items` (search, categoryId, minPrice, maxPrice, excludeAllergens, diet, maxSpice, sort) · `/:id/reviews` | 누구나 |
| POST / PATCH / DELETE | `/api/restaurants` · `/api/categories` · `/api/menu-items` | 해당 가게 사장님 / 관리자 |
| POST | `/api/orders` · `/api/orders/batch`(여러 가게) | 손님 |
| GET | `/api/orders` (status, active, orderType, from, to, customerId, restaurantId, sort) · `/api/orders/:id` | 내 주문 / 내 가게 주문 / 전체 |
| PATCH | `/api/orders/:id/status` | 주문 흐름에 따라 |
| POST | `/api/reviews` · GET/PATCH `/api/reviews` (리뷰 관리) | 손님 · 관리자 |
| GET / POST / PATCH / DELETE | `/api/payment-methods` | 손님 |
| POST | `/api/orders/:id/claim` | 배달기사 |
| GET · PATCH | `/api/admin/dishes` · `/api/admin/dishes/:id/review` | 관리자 |
| GET | `/api/manage/flagged-dishes` | 사장님 |
| GET / POST / PATCH | `/api/admin/users`, GET `/api/admin/stats`, POST `/api/admin/demo/reset` | 관리자 |

목록은 `{ success, items, page, limit, totalCount, totalPages }`, 오류는 `{ success: false, message, code, errors: [{ field, message }] }` 형식으로 반환합니다.

### 주문 상태 흐름

```
배달: pending → preparing → out_for_delivery → delivered → completed
포장: pending → preparing → ready_for_pickup → completed
취소: 손님 — 접수 전에만 · 사장님 — 새 주문 거절 · 관리자 — 진행 중인 모든 주문
```

| 단계 | 누가 |
|---|---|
| pending → preparing | 사장님이 **주문 수락**(수락과 조리 시작이 한 번의 동작이라 별도의 `accepted` 상태는 쓰지 않음) |
| pending → cancelled | 사장님 **거절**, 손님 취소, 또는 `AUTO_CANCEL_MINUTES` 후 자동 |
| preparing → out_for_delivery / ready_for_pickup | 사장님 |
| out_for_delivery → delivered | 배달을 잡은 **배달기사만** |
| delivered → completed | `AUTO_COMPLETE_MINUTES` 후 자동 (손님 확인 불필요, 손님 화면에서는 "배달 완료"가 마지막 단계) |
| ready_for_pickup → completed | 가게가 전달, 또는 `AUTO_COMPLETE_MINUTES` 후 자동 |

주문은 뒤로 돌아가지 않습니다. 완료와 취소는 최종 상태입니다. 결제된 주문을 취소하면 환불됩니다.

## 수동 테스트 체크리스트

`npm run db:reset` 후 브라우저(PC와 휴대폰 화면 너비)에서 확인합니다. 모든 항목은 배포 전에 확인했습니다.

**비회원 & 언어**
- [x] 첫 방문: 환영 화면, 휴대폰/브라우저 언어로 자동 선택. 🌐 버튼으로 모든 문구가 바뀌고, 새로고침해도 유지
- [x] 7개 언어 모두: 번역 안 된 키 없음, 390px 화면에서 레이아웃 깨짐 없음, 다크 모드
- [x] 가게 목록: 검색, 음식 종류, 평점, 기분별 추천, 정렬, 페이지. 비회원은 주문·리뷰 불가(로그인 안내)

**손님** (`customer@demo.com`)
- [x] 식단 여권 켜짐: 맞지 않는 메뉴 표시, 담기 불가. 꺼짐: 표시 없는 일반 메뉴
- [x] 메뉴 상세 → 담기: 메뉴가 장바구니로 날아가고 숫자 배지 갱신
- [x] 두 가게 장바구니 → 한 번 결제 → 주문 2건, 배달비 각각. 포장 전용 가게가 있으면 포장으로 주문. 6번째 가게는 담기지 않음
- [x] 저장된 카드로 결제(배달과 포장). 거절 카드 `4000 0000 0000 0002`는 오류 표시
- [x] 접수 전 주문 취소 → 환불. 가게가 수락한 뒤에는 취소 불가
- [x] 배달 중 / 배달 완료: 배달기사 이름과 전화 버튼. 배달 후 주문이 자동 완료되고 "어떠셨어요?" 카드가 뜨며, 별을 누르면 리뷰 작성 화면. 같은 주문에 두 번째 리뷰 불가
- [x] `/admin` 또는 `/manage` 접속 → "접근 권한이 없어요"

**사장님** (`owner@demo.com`)
- [x] 새 주문 수락 / 거절, 배달 출발, "기사 배정 대기" → "배달기사 이동 중"
- [x] 카테고리와 메뉴: 추가, 수정, 품절, 삭제, 사진 업로드(이미지가 아니거나 2MB 초과면 거부)
- [x] 관리자의 메뉴 수정 요청이 대시보드에 표시, "지금 수정하기"를 누르면 관리자 메시지와 함께 메뉴가 열림

**배달기사** (`courier@demo.com`)
- [x] 대기 중인 배달 잡기, 다른 기사는 그 배달을 잡거나 완료할 수 없음, 배달 완료 후 기록으로 이동

**관리자** (`admin@demo.com`)
- [x] 대시보드 숫자와 주문 상태(번역됨), 회원: 검색, 역할 필터, 비활성화
- [x] 가게 승인, 사장님 지정, 주문은 조회만 가능
- [x] 메뉴 검수: OK / 메시지와 함께 수정 요청, 리뷰: 숨기기 / 보이기(평점 재계산)
- [x] 데모 데이터 초기화

**디자인**
- [x] 밝은 / 어두운 테마가 휴대폰 설정을 따르고 상단에서 전환, 로고·아이콘·장면 색도 함께 바뀜
- [x] 장바구니로 날아가는 반짝임, 조리 중 셰프, 배달 중 지도 위 배달기사, 배달 완료 때 손 흔드는 배달기사
- [x] 영업 전 가게: 카드에 "영업 전 · … 오픈", 주문 불가, 사장님은 가게 정보에서 영업시간 설정

## 프로젝트 구조

```
server/src
  config/       환경 변수, DB 풀, 목록(알레르기, 식단, 음식 종류)
  db/           schema.sql, migrate, seed
  middleware/   인증(JWT + 역할), 검증(Zod), 업로드(multer → DB), 오류 처리
  validators/   요청 DTO (Zod)
  services/     비즈니스 로직: 인증, 회원, 가게, 메뉴, 주문 + 상태 머신, 리뷰, 결제, 번역
  controllers/  얇은 HTTP 계층
  routes/       모든 /api 경로
  docs/         openapi.yaml
server/tests    Jest + Supertest
client/src
  api/          fetch 클라이언트(쿠키, 오류 정규화, 401 처리)
  context/      인증, 장바구니(localStorage), 알림, 메타
  i18n/         en, ko, zh, vi, th, ru, ja (.json)
  components/   UI 키트, 레이아웃, 카드, 주소 검색, 결제 카드, 이미지 입력
  pages/        손님, Courier(배달기사), manage/(사장님), admin/(관리자)
```

## 보안

- 비밀번호는 bcrypt로 해시. JWT는 **httpOnly, SameSite=Lax** 쿠키에 저장(운영 환경에서는 Secure).
- 로그인 실패 시 동일한 오류 메시지와 일정한 시간 비교(가입 여부 노출 없음). 로그인·카드 API 요청 횟수 제한.
- 모든 API 입력을 Zod로 검증. 정렬 필드는 허용 목록만, SQL은 파라미터 바인딩.
- 소유권 확인: 손님은 자기 주문만, 사장님은 자기 가게 데이터만 볼 수 있고, 권한 밖의 주문은 404.
- 가격과 합계는 항상 서버에서 다시 계산.
- 업로드: JPEG/PNG/WEBP만, 2MB 이하, 파일 시그니처 확인, PostgreSQL에 저장(재배포해도 유지).
- Helmet Content-Security-Policy로 카카오 우편번호와 토스 스크립트만 허용.
