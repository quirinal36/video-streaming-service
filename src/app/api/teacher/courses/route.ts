import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth-helpers'
import { teacherApi } from '@/lib/api-client'

export async function GET() {
  try {
    const token = await getAccessToken()

    if (!token) {
      return NextResponse.json({ detail: '인증이 필요합니다.' }, { status: 401 })
    }

    const response = await teacherApi.getCourses(token)

    if (response.error) {
      return NextResponse.json({ detail: response.error }, { status: response.status })
    }

    return NextResponse.json(response.data)
  } catch (error) {
    console.error('[teacher/courses GET]', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const token = await getAccessToken()

    if (!token) {
      return NextResponse.json({ detail: '인증이 필요합니다.' }, { status: 401 })
    }

    const data = await request.json()
    console.log('[teacher/courses POST] data:', JSON.stringify(data))

    const response = await teacherApi.createCourse(data, token)
    console.log('[teacher/courses POST] response:', JSON.stringify({ error: response.error, status: response.status }))

    if (response.error) {
      return NextResponse.json({ detail: response.error }, { status: response.status })
    }

    return NextResponse.json(response.data)
  } catch (error) {
    console.error('[teacher/courses POST] error:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
