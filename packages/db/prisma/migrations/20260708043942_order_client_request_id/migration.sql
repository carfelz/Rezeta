/*
  Warnings:

  - A unique constraint covering the columns `[consultation_id,client_request_id]` on the table `imaging_orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[consultation_id,client_request_id]` on the table `lab_orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[consultation_id,client_request_id]` on the table `prescriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "imaging_orders" ADD COLUMN     "client_request_id" VARCHAR(64);

-- AlterTable
ALTER TABLE "lab_orders" ADD COLUMN     "client_request_id" VARCHAR(64);

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "client_request_id" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "imaging_orders_consultation_id_client_request_id_key" ON "imaging_orders"("consultation_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_orders_consultation_id_client_request_id_key" ON "lab_orders"("consultation_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_consultation_id_client_request_id_key" ON "prescriptions"("consultation_id", "client_request_id");
