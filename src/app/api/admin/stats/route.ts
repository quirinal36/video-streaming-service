import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth-helpers'
import { adminApi } from '@/lib/api-client'

export async function GET() {
  const token = await getAccessToken()

  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const response = await adminApi.getStats(token)

  if (response.error) {
    return NextResponse.json({ error: response.error }, { status: response.status })
  }

  return NextResponse.json(response.data)
}
