import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth-helpers'
import { teacherApi } from '@/lib/api-client'

export async function POST(request: Request) {
  const token = await getAccessToken()

  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { course_id, title } = await request.json()
  const response = await teacherApi.getUploadUrl(course_id, title, token)

  if (response.error) {
    return NextResponse.json({ error: response.error }, { status: response.status })
  }

  return NextResponse.json(response.data)
}
