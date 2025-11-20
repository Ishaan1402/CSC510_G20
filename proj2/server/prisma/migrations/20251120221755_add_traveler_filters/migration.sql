-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "isFastService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLocalFavorite" BOOLEAN NOT NULL DEFAULT false;
