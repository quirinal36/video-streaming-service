import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth-helpers'
import { teacherApi } from '@/lib/api-client'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAccessToken()

  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const response = await teacherApi.deleteVideo(id, token)

  if (response.error) {
    return NextResponse.json({ error: response.error }, { status: response.status })
  }

  return NextResponse.json(response.data)
}
