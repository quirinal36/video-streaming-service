/**
 * FastAPI Backend API Client
 * Next.js API Routes에서 FastAPI 백엔드로 요청을 프록시하기 위한 클라이언트
 */

const API_BASE_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * FastAPI 백엔드로 요청을 보내는 클라이언트
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, token } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: data?.detail || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return {
      data: data as T,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network error',
      status: 500,
    };
  }
}

// Auth API
export const authApi = {
  signup: (email: string, password: string, name: string) =>
    apiClient('/api/auth/signup', {
      method: 'POST',
      body: { email, password, name },
    }),

  signin: (email: string, password: string) =>
    apiClient<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      user: { id: string; email: string };
    }>('/api/auth/signin', {
      method: 'POST',
      body: { email, password },
    }),

  signout: (token: string) =>
    apiClient('/api/auth/signout', {
      method: 'POST',
      token,
    }),

  getMe: (token: string) =>
    apiClient<{
      id: string;
      email: string;
      name: string;
      role: string;
      created_at: string;
    }>('/api/auth/me', { token }),
};

// Courses API
export const coursesApi = {
  getAll: (token: string) =>
    apiClient<Array<{
      id: string;
      title: string;
      description: string;
      thumbnail_url: string | null;
      instructor_name: string | null;
      is_published: boolean;
      created_at: string;
    }>>('/api/courses/all', { token }),

  getMyCourses: (token: string) =>
    apiClient<Array<{
      id: string;
      title: string;
      description: string;
      thumbnail_url: string | null;
      instructor_name: string | null;
      is_published: boolean;
      created_at: string;
    }>>('/api/courses', { token }),

  getById: (courseId: string, token: string) =>
    apiClient<{
      id: string;
      title: string;
      description: string;
      thumbnail_url: string | null;
      instructor_name: string | null;
      is_published: boolean;
      created_at: string;
      videos: Array<{
        id: string;
        title: string;
        duration_seconds: number;
        order_index: number;
        bunny_thumbnail: string | null;
      }>;
    }>(`/api/courses/${courseId}`, { token }),

  getVideos: (courseId: string, token: string) =>
    apiClient<Array<{
      id: string;
      title: string;
      description: string | null;
      duration_seconds: number;
      order_index: number;
      bunny_thumbnail: string | null;
      progress_seconds: number;
      is_completed: boolean;
    }>>(`/api/courses/${courseId}/videos`, { token }),
};

// Videos API
export const videosApi = {
  getById: (videoId: string, token: string) =>
    apiClient<{
      id: string;
      title: string;
      description: string | null;
      duration_seconds: number;
      course_id: string;
      bunny_video_id: string;
      bunny_thumbnail: string | null;
      order_index: number;
    }>(`/api/videos/${videoId}`, { token }),

  getSignedUrl: (videoId: string, token: string) =>
    apiClient<{
      signed_url: string;
      iframe_url: string;
      expires_in: number;
    }>(`/api/videos/${videoId}/signed-url`, {
      method: 'POST',
      token,
    }),

  updateProgress: (
    videoId: string,
    progressSeconds: number,
    isCompleted: boolean,
    token: string
  ) =>
    apiClient(`/api/videos/${videoId}/progress`, {
      method: 'POST',
      token,
      body: {
        progress_seconds: progressSeconds,
        is_completed: isCompleted,
      },
    }),

  getProgress: (videoId: string, token: string) =>
    apiClient<{
      progress_seconds: number;
      is_completed: boolean;
    }>(`/api/videos/${videoId}/progress`, { token }),
};

// Admin API
export const adminApi = {
  getStats: (token: string) =>
    apiClient<{
      total_courses: number;
      total_videos: number;
      total_users: number;
      total_enrollments: number;
    }>('/api/admin/stats', { token }),

  getCourses: (token: string) =>
    apiClient<Array<{
      id: string;
      title: string;
      description: string;
      thumbnail_url: string | null;
      teacher_id: string | null;
      is_published: boolean;
      created_at: string;
    }>>('/api/admin/courses', { token }),

  createCourse: (data: { title: string; description?: string | null; thumbnail_url?: string | null; is_published?: boolean }, token: string) =>
    apiClient('/api/admin/courses', { method: 'POST', body: data, token }),

  updateCourse: (courseId: string, data: { title?: string; description?: string | null; thumbnail_url?: string | null; is_published?: boolean }, token: string) =>
    apiClient(`/api/admin/courses/${courseId}`, { method: 'PUT', body: data, token }),

  deleteCourse: (courseId: string, token: string) =>
    apiClient(`/api/admin/courses/${courseId}`, { method: 'DELETE', token }),

  getCourseVideos: (courseId: string, token: string) =>
    apiClient<Array<{
      id: string;
      title: string;
      order_index: number;
    }>>(`/api/admin/courses/${courseId}/videos`, { token }),

  getVideos: (token: string) =>
    apiClient<Array<{
      id: string;
      title: string;
      description: string | null;
      course_id: string;
      bunny_video_id: string;
      duration_seconds: number;
      order_index: number;
    }>>('/api/admin/videos', { token }),

  deleteVideo: (videoId: string, token: string) =>
    apiClient(`/api/admin/videos/${videoId}`, { method: 'DELETE', token }),

  getUploadUrl: (courseId: string, title: string, token: string) =>
    apiClient<{
      upload_url: string;
      bunny_video_id: string;
      upload_headers: Record<string, string>;
    }>(`/api/admin/videos/upload-url?course_id=${courseId}&title=${encodeURIComponent(title)}`, { method: 'POST', token }),

  completeUpload: (params: { bunny_video_id: string; course_id: string; title: string; description?: string; order_index?: number }, token: string) =>
    apiClient(`/api/admin/videos/complete-upload?bunny_video_id=${params.bunny_video_id}&course_id=${params.course_id}&title=${encodeURIComponent(params.title)}&description=${encodeURIComponent(params.description || '')}&order_index=${params.order_index || 0}`, { method: 'POST', token }),

  getUsers: (token: string) =>
    apiClient<Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      created_at: string;
    }>>('/api/admin/users', { token }),

  updateUserRole: (userId: string, role: string, token: string) =>
    apiClient(`/api/admin/users/${userId}/role`, { method: 'PUT', body: { role }, token }),

  getEnrollments: (token: string) =>
    apiClient<Array<{
      id: string;
      user_id: string;
      course_id: string;
      enrolled_at: string;
      expires_at: string | null;
    }>>('/api/admin/enrollments', { token }),

  createEnrollment: (userId: string, courseId: string, token: string) =>
    apiClient('/api/admin/enrollments', { method: 'POST', body: { user_id: userId, course_id: courseId }, token }),

  deleteEnrollment: (enrollmentId: string, token: string) =>
    apiClient(`/api/admin/enrollments/${enrollmentId}`, { method: 'DELETE', token }),
};

export default apiClient;
