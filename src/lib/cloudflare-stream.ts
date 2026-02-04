import jwt from 'jsonwebtoken'

interface SignedUrlOptions {
  videoId: string
  expiresInHours?: number
  downloadable?: boolean
}

interface AccessRule {
  type: string
  country?: string[]
  action: 'allow' | 'block'
}

/**
 * Cloudflare Stream Signed URL 생성
 * Signing Key 방식 사용 (프로덕션 권장)
 */
export function generateSignedUrl(options: SignedUrlOptions): string {
  const { videoId, expiresInHours = 2, downloadable = false } = options

  const signingKeyId = process.env.CLOUDFLARE_SIGNING_KEY_ID
  const signingKeyPem = process.env.CLOUDFLARE_SIGNING_KEY_PEM
  const customerCode = process.env.CLOUDFLARE_CUSTOMER_CODE

  if (!signingKeyId || !signingKeyPem) {
    throw new Error('Cloudflare Signing Key가 설정되지 않았습니다.')
  }

  // Base64로 인코딩된 PEM 키 디코딩
  const privateKey = Buffer.from(signingKeyPem, 'base64').toString('utf-8')

  // 접근 제어 규칙 (한국만 허용 - 선택적)
  const accessRules: AccessRule[] = [
    // { type: 'ip.geoip.country', country: ['KR'], action: 'allow' },
    // { type: 'any', action: 'block' }
  ]

  const payload = {
    sub: videoId,
    kid: signingKeyId,
    exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600,
    downloadable,
    ...(accessRules.length > 0 && { accessRules })
  }

  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' })

  // Stream URL 생성
  if (customerCode) {
    return `https://customer-${customerCode}.cloudflarestream.com/${videoId}/manifest/video.m3u8?token=${token}`
  }

  // Customer code가 없는 경우 기본 URL 형식
  return `https://cloudflarestream.com/${videoId}/manifest/video.m3u8?token=${token}`
}

/**
 * Cloudflare Stream iframe embed URL 생성
 */
export function generateEmbedUrl(options: SignedUrlOptions): string {
  const { videoId, expiresInHours = 2 } = options

  const signingKeyId = process.env.CLOUDFLARE_SIGNING_KEY_ID
  const signingKeyPem = process.env.CLOUDFLARE_SIGNING_KEY_PEM
  const customerCode = process.env.CLOUDFLARE_CUSTOMER_CODE

  if (!signingKeyId || !signingKeyPem) {
    throw new Error('Cloudflare Signing Key가 설정되지 않았습니다.')
  }

  const privateKey = Buffer.from(signingKeyPem, 'base64').toString('utf-8')

  const payload = {
    sub: videoId,
    kid: signingKeyId,
    exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600,
  }

  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' })

  if (customerCode) {
    return `https://customer-${customerCode}.cloudflarestream.com/${videoId}/iframe?token=${token}`
  }

  return `https://cloudflarestream.com/${videoId}/iframe?token=${token}`
}

/**
 * Cloudflare Stream API를 통해 비디오 정보 조회
 */
export async function getVideoInfo(videoId: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare API 설정이 필요합니다.')
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error('비디오 정보를 가져올 수 없습니다.')
  }

  const data = await response.json()
  return data.result
}

/**
 * Cloudflare Stream API를 통해 모든 비디오 목록 조회
 */
export async function listVideos() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare API 설정이 필요합니다.')
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error('비디오 목록을 가져올 수 없습니다.')
  }

  const data = await response.json()
  return data.result
}
