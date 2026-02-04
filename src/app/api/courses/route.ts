import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 강의 목록 조회
export async function GET() {
  try {
    const supabase = await createClient()

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 사용자가 등록한 강의 목록 조회 (RLS가 적용됨)
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        course_id,
        enrolled_at,
        expires_at,
        courses (
          id,
          title,
          description,
          thumbnail_url,
          is_published,
          created_at
        )
      `)
      .eq('user_id', user.id)

    if (enrollmentError) {
      console.error('Enrollments fetch error:', enrollmentError)
      return NextResponse.json(
        { error: '강의 목록을 가져오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 각 강의의 비디오 수와 시청 진도 계산
    const coursesWithProgress = await Promise.all(
      (enrollments || []).map(async (enrollment) => {
        const course = enrollment.courses as {
          id: string
          title: string
          description: string | null
          thumbnail_url: string | null
          is_published: boolean
          created_at: string
        }

        // 강의의 비디오 수 조회
        const { count: videoCount } = await supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id)

        // 시청 완료한 비디오 수 조회
        const { count: completedCount } = await supabase
          .from('watch_history')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_completed', true)
          .in('video_id',
            (await supabase
              .from('videos')
              .select('id')
              .eq('course_id', course.id)
            ).data?.map(v => v.id) || []
          )

        return {
          ...course,
          enrolled_at: enrollment.enrolled_at,
          expires_at: enrollment.expires_at,
          video_count: videoCount || 0,
          completed_count: completedCount || 0,
          progress: videoCount ? Math.round((completedCount || 0) / videoCount * 100) : 0,
        }
      })
    )

    return NextResponse.json({
      courses: coursesWithProgress,
    })
  } catch (error) {
    console.error('Courses fetch error:', error)
    return NextResponse.json(
      { error: '강의 목록을 가져오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
