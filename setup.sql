-- ============================================
-- Vår Odlingslott - Database Setup
-- Paste this entire script into Supabase SQL Editor and click "Run"
-- ============================================

-- Posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  url TEXT NOT NULL,
  caption TEXT,
  author_name TEXT NOT NULL DEFAULT 'Anonym',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comments table
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anonym',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Posts policies (allow all - site is password-protected on frontend)
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (true);

-- Comments policies
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (true);

-- Create storage bucket for uploaded images
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- Storage policies for the images bucket
CREATE POLICY "images_select" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "images_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');
CREATE POLICY "images_delete" ON storage.objects FOR DELETE USING (bucket_id = 'images');
