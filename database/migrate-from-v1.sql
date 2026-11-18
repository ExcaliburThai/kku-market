-- ONLY for users of the OLD Firebase Storage ZIP. Back up first.
-- Run once, not on a new schema; old image_path remains but is unused.
USE kku_market;
ALTER TABLE posts ADD COLUMN image_url VARCHAR(1024) DEFAULT NULL;
ALTER TABLE posts ADD COLUMN image_public_id VARCHAR(255) DEFAULT NULL;
-- Next run schema.sql to add email_outbox. Existing text posts are preserved.
-- Old Firebase images are NOT migrated automatically.
