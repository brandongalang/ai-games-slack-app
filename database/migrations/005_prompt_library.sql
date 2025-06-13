-- Prompt Library Schema Extension
-- Migration for Task 18: Implement Prompt Library MVP

-- Prompt Library Collections table (for organizing prompts)
CREATE TABLE IF NOT EXISTS prompt_collections (
    collection_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    creator_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_system_collection BOOLEAN DEFAULT false, -- For curated collections like "Top Quality", "Weekly Challenges"
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt Library Items table (references submissions that are promoted to library)
CREATE TABLE IF NOT EXISTS prompt_library_items (
    library_item_id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(submission_id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- Can override submission title for library
    description TEXT, -- Can override submission description
    category TEXT NOT NULL, -- 'writing', 'coding', 'analysis', 'creative', 'business', etc.
    subcategory TEXT, -- More specific categorization
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    estimated_time_minutes INTEGER, -- How long this prompt typically takes
    use_case_tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- 'brainstorming', 'research', 'automation', etc.
    quality_score REAL, -- Aggregate quality from clarity, helpfulness, usage
    usage_count INTEGER DEFAULT 0, -- How many times it's been used/favorited
    curator_notes TEXT, -- Admin/curator comments
    is_featured BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false, -- Verified by admins/curators
    promoted_by INTEGER REFERENCES users(user_id), -- Who promoted it to library
    promoted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id) -- Each submission can only be in library once
);

-- Collection Items junction table (many-to-many)
CREATE TABLE IF NOT EXISTS collection_items (
    collection_id INTEGER REFERENCES prompt_collections(collection_id) ON DELETE CASCADE,
    library_item_id INTEGER REFERENCES prompt_library_items(library_item_id) ON DELETE CASCADE,
    added_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (collection_id, library_item_id)
);

-- User Favorites table (for users to favorite library items)
CREATE TABLE IF NOT EXISTS user_favorites (
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    library_item_id INTEGER REFERENCES prompt_library_items(library_item_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, library_item_id)
);

-- Library Usage Analytics table
CREATE TABLE IF NOT EXISTS library_usage_analytics (
    usage_id SERIAL PRIMARY KEY,
    library_item_id INTEGER REFERENCES prompt_library_items(library_item_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'view', 'copy', 'favorite', 'share', 'remix'
    source TEXT, -- 'search', 'browse', 'collection', 'featured'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Library Search/Filter Views for performance
CREATE INDEX IF NOT EXISTS idx_library_items_category ON prompt_library_items(category);
CREATE INDEX IF NOT EXISTS idx_library_items_quality_score ON prompt_library_items(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_usage_count ON prompt_library_items(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_promoted_at ON prompt_library_items(promoted_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_difficulty ON prompt_library_items(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_library_items_featured ON prompt_library_items(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_library_items_verified ON prompt_library_items(is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_library_items_tags ON prompt_library_items USING GIN(use_case_tags);

CREATE INDEX IF NOT EXISTS idx_collections_public ON prompt_collections(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_collections_featured ON prompt_collections(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_collections_creator ON prompt_collections(creator_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_item ON library_usage_analytics(library_item_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user ON library_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_created ON library_usage_analytics(created_at);

-- Text search index for library items
CREATE INDEX IF NOT EXISTS idx_library_items_text_search ON prompt_library_items USING GIN(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || array_to_string(use_case_tags, ' '))
);

-- Apply updated_at triggers to new tables
CREATE TRIGGER update_prompt_collections_updated_at 
    BEFORE UPDATE ON prompt_collections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_library_items_updated_at 
    BEFORE UPDATE ON prompt_library_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create default system collections
INSERT INTO prompt_collections (name, description, is_system_collection, is_featured, is_public) VALUES
('Top Quality Prompts', 'The highest-rated prompts from our community, verified for clarity and effectiveness.', true, true, true),
('Beginner Friendly', 'Great prompts to get started with AI - clear, simple, and effective.', true, true, true),
('Creative Writing', 'Prompts for creative writing, storytelling, and artistic expression.', true, false, true),
('Business & Productivity', 'Prompts for business analysis, productivity, and professional tasks.', true, false, true),
('Coding & Development', 'Programming prompts for code generation, debugging, and development workflows.', true, false, true),
('Research & Analysis', 'Data analysis, research, and analytical thinking prompts.', true, false, true),
('Weekly Challenge Winners', 'The best submissions from our weekly prompt challenges.', true, true, true)
ON CONFLICT DO NOTHING;

-- Function to automatically promote high-quality submissions to library
CREATE OR REPLACE FUNCTION auto_promote_to_library()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-promote submissions with high clarity score and good engagement
    IF NEW.clarity_score >= 8.0 AND NEW.is_promoted_to_library = false THEN
        INSERT INTO prompt_library_items (
            submission_id,
            title,
            description,
            category,
            difficulty_level,
            quality_score,
            promoted_by
        ) VALUES (
            NEW.submission_id,
            COALESCE(NEW.title, 'Untitled Prompt'),
            NEW.description,
            CASE 
                WHEN 'coding' = ANY(NEW.tags) OR 'programming' = ANY(NEW.tags) THEN 'coding'
                WHEN 'writing' = ANY(NEW.tags) OR 'creative' = ANY(NEW.tags) THEN 'writing'
                WHEN 'business' = ANY(NEW.tags) OR 'analysis' = ANY(NEW.tags) THEN 'business'
                WHEN 'research' = ANY(NEW.tags) THEN 'research'
                ELSE 'general'
            END,
            CASE 
                WHEN NEW.clarity_score >= 9.0 THEN 'beginner'
                WHEN NEW.clarity_score >= 8.5 THEN 'intermediate'
                ELSE 'advanced'
            END,
            NEW.clarity_score,
            NEW.author_id
        ) ON CONFLICT (submission_id) DO NOTHING;
        
        -- Mark submission as promoted
        NEW.is_promoted_to_library = true;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-promotion
CREATE TRIGGER auto_promote_high_quality_submissions
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    WHEN (NEW.clarity_score IS NOT NULL AND (OLD.clarity_score IS NULL OR OLD.clarity_score != NEW.clarity_score))
    EXECUTE FUNCTION auto_promote_to_library();

-- Function to update usage count when item is favorited
CREATE OR REPLACE FUNCTION update_library_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE prompt_library_items 
        SET usage_count = usage_count + 1 
        WHERE library_item_id = NEW.library_item_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE prompt_library_items 
        SET usage_count = GREATEST(0, usage_count - 1) 
        WHERE library_item_id = OLD.library_item_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger for usage count updates
CREATE TRIGGER update_usage_count_on_favorite
    AFTER INSERT OR DELETE ON user_favorites
    FOR EACH ROW EXECUTE FUNCTION update_library_usage_count();