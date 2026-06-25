/*
  Warnings:

  - You are about to drop the column `gps_coordinates` on the `emergency_events` table. All the data in the column will be lost.
  - You are about to drop the column `last_known_location` on the `hiking_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `location_logs` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `trail_pois` table. All the data in the column will be lost.
  - You are about to drop the column `end_point` on the `trails` table. All the data in the column will be lost.
  - You are about to drop the column `route_geom` on the `trails` table. All the data in the column will be lost.
  - You are about to drop the column `start_point` on the `trails` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "session_status" ADD VALUE 'in_gestione';


-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" VARCHAR(500),
ADD COLUMN     "location" VARCHAR(150);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "trail_id" UUID NOT NULL,
    "image_path" VARCHAR(255) NOT NULL,
    "caption" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trail_reviews" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "trail_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trail_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_likes_user_id_post_id_key" ON "post_likes"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "trail_reviews_user_id_trail_id_key" ON "trail_reviews"("user_id", "trail_id");

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "trails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_reviews" ADD CONSTRAINT "trail_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trail_reviews" ADD CONSTRAINT "trail_reviews_trail_id_fkey" FOREIGN KEY ("trail_id") REFERENCES "trails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
