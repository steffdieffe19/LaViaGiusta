import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏗️ Creating community_posts table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_posts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
      image_path VARCHAR(255) NOT NULL,
      caption TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table community_posts verified/created successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
