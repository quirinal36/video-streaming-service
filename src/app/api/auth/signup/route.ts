import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: '이메일/비밀번호 회원가입은 지원하지 않습니다. 소셜 로그인을 이용해주세요.' },
    { status: 403 }
  )
}
