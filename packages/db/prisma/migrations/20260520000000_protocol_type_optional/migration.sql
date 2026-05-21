-- Allow protocols to exist without a type (blank/scratch protocols).
ALTER TABLE "protocols" ALTER COLUMN "type_id" DROP NOT NULL;
