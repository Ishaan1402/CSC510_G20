-- CreateEnum
CREATE TYPE "PriceLevel" AS ENUM ('BUDGET', 'MID', 'UPSCALE');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "priceLevel" "PriceLevel" DEFAULT 'MID';
