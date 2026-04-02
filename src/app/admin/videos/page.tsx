'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

async function getToken() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }

  return res.json()
}

interface Course {
  id: string
  title: string
}

interface Video {
  id: string
  title: string
  description: string | null
  course_id: string
  bunny_video_id: string
  duration_seconds: number
  order_index: number
}

interface UploadProgress {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  progress: number
  message: string
}

export default function AdminVideosPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    order_index: 0,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [coursesData, videosData] = await Promise.all([
        apiFetch('/api/admin/courses'),
        apiFetch('/api/admin/videos'),
      ])
      setCourses(coursesData)
      setVideos(videosData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
    setLoading(false)
  }

  const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      alert(`파일 크기가 너무 큽니다. 최대 500MB까지 업로드 가능합니다.\n현재 파일 크기: ${(file.size / 1024 / 1024).toFixed(1)}MB`)
      e.target.value = ''
      return
    }

    if (!formData.title) {
      setFormData({ ...formData, title: file.name.replace(/\.[^/.]+$/, '') })
    }
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file || !selectedCourse || !formData.title) {
      alert('강의와 파일, 제목을 모두 입력해주세요.')
      return
    }

    try {
      setUploadProgress({ status: 'uploading', progress: 0, message: '업로드 URL 요청 중...' })

      // 1. 업로드 URL 요청
      const uploadData = await apiFetch('/api/admin/videos/upload-url', {
        method: 'POST',
        body: JSON.stringify({ course_id: selectedCourse, title: formData.title }),
      })

      const { upload_url, bunny_video_id, upload_headers } = uploadData

      setUploadProgress({ status: 'uploading', progress: 10, message: 'Bunny Stream에 업로드 중...' })

      // 2. Bunny Stream에 직접 업로드 (PUT binary)
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: upload_headers,
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error('Bunny Stream 업로드 실패')
      }

      setUploadProgress({ status: 'processing', progress: 70, message: '비디오 처리 중...' })

      // 3. 업로드 완료 후 DB 저장
      await apiFetch('/api/admin/videos/complete-upload', {
        method: 'POST',
        body: JSON.stringify({
          bunny_video_id,
          course_id: selectedCourse,
          title: formData.title,
          description: formData.description || '',
          order_index: formData.order_index,
        }),
      })

      setUploadProgress({ status: 'complete', progress: 100, message: '업로드 완료!' })

      // 폼 초기화
      setFormData({ title: '', description: '', order_index: 0 })
      if (fileInputRef.current) fileInputRef.current.value = ''

      // 목록 새로고침
      fetchData()

      setTimeout(() => {
        setUploadProgress({ status: 'idle', progress: 0, message: '' })
      }, 3000)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadProgress({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '업로드 실패',
      })
    }
  }

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await apiFetch(`/api/admin/videos/${videoId}`, { method: 'DELETE' })
      fetchData()
    } catch (error) {
      console.error('Delete error:', error)
      alert('삭제 실패')
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">비디오 업로드</h1>

      {/* 업로드 폼 */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">새 비디오 업로드</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강의 선택 *
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">강의를 선택하세요</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비디오 제목 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="비디오 제목"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="비디오 설명"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              순서
            </label>
            <input
              type="number"
              value={formData.order_index}
              onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2"
              min="0"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            비디오 파일 * <span className="text-gray-400 font-normal">(최대 500MB)</span>
          </label>
          <input
            type="file"
            ref={fileInputRef}
            accept="video/*"
            onChange={handleFileSelect}
            className="w-full border rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            지원 형식: MP4, MOV, AVI, MKV, WebM
          </p>
        </div>

        {uploadProgress.status !== 'idle' && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>{uploadProgress.message}</span>
              <span>{uploadProgress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  uploadProgress.status === 'error'
                    ? 'bg-red-600'
                    : uploadProgress.status === 'complete'
                    ? 'bg-green-600'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${uploadProgress.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'
            ? '업로드 중...'
            : '업로드'}
        </button>
      </div>

      {/* 비디오 목록 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <h2 className="text-lg font-semibold p-6 border-b">비디오 목록</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                비디오
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                강의
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                길이
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                순서
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {videos.map((video) => (
              <tr key={video.id}>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{video.title}</div>
                  <div className="text-xs text-gray-500">{video.bunny_video_id}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {courses.find(c => c.id === video.course_id)?.title || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {formatDuration(video.duration_seconds)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {video.order_index}
                </td>
                <td className="px-6 py-4 text-right text-sm">
                  <button
                    onClick={() => handleDeleteVideo(video.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {videos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            등록된 비디오가 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
