-- Final fix for schema inconsistencies

-- Check if content column exists and handle it
DO $$ 
BEGIN
    -- If content column exists, copy its data to prompt_text and drop it
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'submissions' AND column_name = 'content') THEN
        
        -- If prompt_text doesn't exist, add it
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'submissions' AND column_name = 'prompt_text') THEN
            ALTER TABLE submissions ADD COLUMN prompt_text TEXT;
        END IF;
        
        -- Copy data from content to prompt_text
        UPDATE submissions SET prompt_text = content WHERE prompt_text IS NULL OR prompt_text = '';
        
        -- Drop the old content column
        ALTER TABLE submissions DROP COLUMN content;
        
        -- Make prompt_text NOT NULL
        ALTER TABLE submissions ALTER COLUMN prompt_text SET NOT NULL;
        
    ELSE
        -- If content doesn't exist but prompt_text does, make sure it's NOT NULL
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'submissions' AND column_name = 'prompt_text') THEN
            ALTER TABLE submissions ALTER COLUMN prompt_text SET NOT NULL;
        ELSE
            -- Neither exists, add prompt_text
            ALTER TABLE submissions ADD COLUMN prompt_text TEXT NOT NULL DEFAULT '';
        END IF;
    END IF;
END $$;

-- Ensure all other required columns exist
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS output_sample TEXT,
ADD COLUMN IF NOT EXISTS output_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS parent_submission_id INTEGER REFERENCES submissions(submission_id);

-- Show current schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'submissions' 
ORDER BY ordinal_position;