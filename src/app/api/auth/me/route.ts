import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth-helpers'
import { authApi } from '@/lib/api-client'

export async function GET() {
  try {
    const token = await getAccessToken()

    if (!token) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const response = await authApi.getMe(token)

    if (response.error) {
      return NextResponse.json(
        { error: response.error },
        { status: response.status }
      )
    }

    return NextResponse.json(response.data)
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json(
      { error: '사용자 정보를 가져오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
