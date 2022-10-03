/*
  Warnings:

  - A unique constraint covering the columns `[namespace,name]` on the table `Pokemon` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Pokemon_namespace_name_key" ON "Pokemon"("namespace", "name");
