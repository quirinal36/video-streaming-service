import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth-helpers'
import { teacherApi } from '@/lib/api-client'

export async function GET() {
  const token = await getAccessToken()

  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const response = await teacherApi.getCourses(token)

  if (response.error) {
    return NextResponse.json({ error: response.error }, { status: response.status })
  }

  return NextResponse.json(response.data)
}

export async function POST(request: Request) {
  const token = await getAccessToken()

  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const data = await request.json()
  const response = await teacherApi.createCourse(data, token)

  if (response.error) {
    return NextResponse.json({ error: response.error }, { status: response.status })
  }

  return NextResponse.json(response.data)
}
