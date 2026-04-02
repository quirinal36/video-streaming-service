-- Migration: Add teacher role, course ownership, and comments system

-- 1. Add 'teacher' role to profiles CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'teacher', 'admin'));

-- 2. Add teacher_id to courses table (nullable, so existing courses still work)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id);

-- 3. Create comments table for students to comment on videos
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- updated_at trigger for comments
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. RLS for comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Anyone enrolled in the course can view comments on its videos
CREATE POLICY "Enrolled users can view comments"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM videos v
            JOIN enrollments e ON e.course_id = v.course_id
            WHERE v.id = comments.video_id
            AND e.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher'))
    );

-- Students can create comments on videos they're enrolled in
CREATE POLICY "Enrolled users can create comments"
    ON comments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM videos v
            JOIN enrollments e ON e.course_id = v.course_id
            WHERE v.id = comments.video_id
            AND e.user_id = auth.uid()
        )
    );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
    ON comments FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own comments, admins/teachers can delete any
CREATE POLICY "Users can delete own comments"
    ON comments FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'teacher')
        )
    );

-- 5. Update existing RLS policies for teacher role on courses and videos

-- Teachers can view and manage their own courses
CREATE POLICY "Teachers can manage own courses"
    ON courses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'teacher'
        )
        AND teacher_id = auth.uid()
    );

-- Teachers can view and manage videos in their own courses
CREATE POLICY "Teachers can manage own course videos"
    ON videos FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM courses c
            JOIN profiles p ON p.id = auth.uid()
            WHERE c.id = videos.course_id
            AND c.teacher_id = auth.uid()
            AND p.role = 'teacher'
        )
    );

-- Teachers can view enrollments for their own courses
CREATE POLICY "Teachers can view own course enrollments"
    ON enrollments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM courses c
            WHERE c.id = enrollments.course_id
            AND c.teacher_id = auth.uid()
        )
    );
