import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: createServerClient와 supabase.auth.getUser() 사이에서
  // 어떤 코드도 작성하지 마세요. 간단한 실수로 사용자가 무작위로 로그아웃될 수 있습니다.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 보호된 경로 체크
  const protectedPaths = ['/courses', '/api/videos', '/api/courses']
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    // 로그인하지 않은 사용자를 로그인 페이지로 리다이렉트
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // 이미 로그인한 사용자가 로그인/회원가입 페이지 접근 시
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/courses'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
