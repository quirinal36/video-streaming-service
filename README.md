# 온라인 강의 비디오 스트리밍 서비스

회원 인증 기반의 온라인 교육 플랫폼입니다. 인증된 학생만 강의 영상에 접근하여 시청할 수 있습니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16 + React 19 + TailwindCSS |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| Video Streaming | Bunny Stream |
| Authentication | Supabase Auth + JWT |

## 주요 기능

- **사용자 인증**: 이메일/비밀번호 로그인, 회원가입
- **강의 관리**: 강의 생성, 수정, 삭제 (관리자)
- **비디오 스트리밍**: Bunny Stream 기반 보안 스트리밍
- **수강 권한 관리**: 등록된 강의만 시청 가능
- **시청 진도 저장**: 이어보기 기능

## 시작하기

### 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성하고 값을 입력하세요:

```bash
cp .env.example .env
```

### Docker로 실행 (권장)

개발 환경 (Hot Reload):
```bash
docker compose -f docker-compose.dev.yml up
```

프로덕션 환경:
```bash
docker compose up -d
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

### 로컬에서 직접 실행

#### Frontend (Next.js)

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

http://localhost:8000/docs 에서 API 문서를 확인할 수 있습니다.

## 프로젝트 구조

```
video-streaming-service/
├── src/                    # Next.js Frontend
│   ├── app/               # App Router 페이지
│   │   ├── (auth)/        # 로그인/회원가입
│   │   ├── admin/         # 관리자 페이지
│   │   ├── courses/       # 강의 목록/상세
│   │   └── api/           # API Routes
│   ├── components/        # React 컴포넌트
│   └── lib/               # 유틸리티 (Bunny, Supabase)
├── backend/               # FastAPI Backend
│   └── app/
│       ├── routers/       # API 라우터
│       ├── services/      # Bunny, Supabase 서비스
│       └── schemas/       # Pydantic 스키마
└── supabase/              # DB 스키마 & 마이그레이션
```

## 참고 자료

- [Bunny Stream API](https://docs.bunny.net/reference/stream-api-overview)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## 라이선스

Private - All rights reserved.
