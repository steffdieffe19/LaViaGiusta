import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏗️ Creating trail_reviews table...');
  
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS trail_reviews (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, trail_id)
    );
  `);
  console.log('✅ Table trail_reviews verified/created successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
