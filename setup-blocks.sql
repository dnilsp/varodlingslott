-- ============================================
-- Block-based posts migration
-- Run in Supabase SQL Editor (replaces old posts schema)
-- ============================================

DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS post_blocks CASCADE;
DROP TABLE IF EXISTS posts CASCADE;

CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonym',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE post_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video', 'subtitle')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anonym',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (true);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (true);

CREATE POLICY "post_blocks_select" ON post_blocks FOR SELECT USING (true);
CREATE POLICY "post_blocks_insert" ON post_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "post_blocks_update" ON post_blocks FOR UPDATE USING (true);
CREATE POLICY "post_blocks_delete" ON post_blocks FOR DELETE USING (true);

CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (true);

-- Storage bucket (skip if already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "images_select" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "images_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');
CREATE POLICY "images_delete" ON storage.objects FOR DELETE USING (bucket_id = 'images');
