import { test, expect } from '@playwright/test'
import path from 'path'

const BASE_URL = 'https://roblox.letscoding.kr'

test.describe('Teacher Workflow - 강의 생성 및 비디오 추가', () => {
  test.use({ baseURL: BASE_URL })

  // 타임아웃을 넉넉하게 설정 (수동 로그인 + 비디오 업로드 대기)
  test.setTimeout(300_000)

  test('teacher가 강의를 생성하고 비디오를 추가할 수 있다', async ({ page }) => {
    // ============================================
    // Step 1: 로그인 (수동)
    // ============================================
    await page.goto(`${BASE_URL}/login`)
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()

    // 사용자가 직접 로그인할 수 있도록 일시정지
    // coding-edu@kakao.com 계정으로 로그인해주세요
    await page.pause()

    // 로그인 완료 확인 - 강사 대시보드로 이동 가능한 상태
    await page.goto(`${BASE_URL}/teacher`)
    await expect(page.getByText('강사 대시보드')).toBeVisible({ timeout: 15_000 })
    console.log('[PASS] 로그인 완료 - 강사 대시보드 접근 성공')

    // ============================================
    // Step 2: 강의(Course) 생성
    // ============================================
    await page.goto(`${BASE_URL}/teacher/courses`)
    await expect(page.getByText('내 강의 관리')).toBeVisible({ timeout: 10_000 })

    // "새 강의" 버튼 클릭
    await page.getByRole('button', { name: '+ 새 강의' }).click()
    await expect(page.getByText('새 강의 만들기')).toBeVisible()

    // 강의 정보 입력
    const testCourseTitle = `E2E 테스트 강의 ${Date.now()}`
    await page.locator('input[type="text"]').first().fill(testCourseTitle)
    await page.locator('textarea').fill('Playwright E2E 테스트로 생성된 강의입니다.')

    // 공개 여부 체크
    await page.locator('#is_published').check()

    // 생성 버튼 클릭
    await page.getByRole('button', { name: '생성' }).click()

    // 강의 목록에 새 강의가 나타나는지 확인
    await expect(page.getByText(testCourseTitle)).toBeVisible({ timeout: 10_000 })
    console.log(`[PASS] 강의 생성 완료: ${testCourseTitle}`)

    // ============================================
    // Step 3: 비디오 업로드
    // ============================================
    await page.goto(`${BASE_URL}/teacher/videos`)
    await expect(page.getByText('비디오 업로드')).toBeVisible({ timeout: 10_000 })

    // 강의 선택
    const courseSelect = page.locator('select').first()
    await courseSelect.waitFor({ state: 'visible' })

    // 방금 생성한 강의 선택
    await courseSelect.selectOption({ label: testCourseTitle })

    // 비디오 제목 입력
    const videoTitle = `E2E 테스트 비디오 ${Date.now()}`
    await page.locator('input[placeholder="비디오 제목"]').fill(videoTitle)
    await page.locator('input[placeholder="비디오 설명"]').fill('E2E 테스트 비디오')

    // 테스트용 비디오 파일 생성 및 업로드
    // 작은 테스트 비디오 파일을 만들어서 업로드
    const fileInput = page.locator('input[type="file"]')

    // 사용자가 비디오 파일을 선택할 수 있도록 일시정지
    // 테스트용 비디오 파일을 선택해주세요
    await page.pause()

    // 업로드 버튼 클릭
    await page.getByRole('button', { name: '업로드' }).click()

    // 업로드 진행 상태 확인
    await expect(page.getByText('업로드 URL 요청 중...')).toBeVisible({ timeout: 10_000 })
    console.log('[PASS] 업로드 시작됨')

    // Bunny Stream 업로드 진행 확인
    await expect(page.getByText(/Bunny Stream에 업로드 중|비디오 처리 중|업로드 완료/)).toBeVisible({ timeout: 60_000 })

    // 업로드 완료 대기
    await expect(page.getByText('업로드 완료!')).toBeVisible({ timeout: 120_000 })
    console.log('[PASS] 비디오 업로드 완료')

    // ============================================
    // Step 4: 비디오 목록에서 확인
    // ============================================
    // 페이지 새로고침 후 비디오 목록 확인
    await page.reload()
    await expect(page.getByText('비디오 목록')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(videoTitle)).toBeVisible({ timeout: 10_000 })
    console.log(`[PASS] 비디오 목록에서 확인: ${videoTitle}`)

    // ============================================
    // Step 5: 강의 페이지에서 비디오 개수 확인
    // ============================================
    await page.goto(`${BASE_URL}/teacher/courses`)
    await expect(page.getByText(testCourseTitle)).toBeVisible({ timeout: 10_000 })

    // 해당 강의의 비디오 개수가 1개 이상인지 확인
    const courseRow = page.locator('tr', { has: page.getByText(testCourseTitle) })
    await expect(courseRow.getByText(/[1-9]\d*개/)).toBeVisible({ timeout: 10_000 })
    console.log('[PASS] 강의에 비디오가 연결된 것을 확인')

    console.log('\n========================================')
    console.log('Teacher 워크플로우 E2E 테스트 전체 통과!')
    console.log('========================================')
  })
})
