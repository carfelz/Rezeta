-- Enable required extensions for the rezeta_dev database.
-- Prisma's postgresqlExtensions preview feature will also handle this
-- during migrations, but we pre-enable them so manual psql sessions work too.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
