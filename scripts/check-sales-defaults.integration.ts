import { prisma } from "@challenge/database";

async function main() {
  const warehouses = await prisma.warehouses.findMany({ orderBy: { id: "asc" } });
  console.log("WAREHOUSES:", warehouses.map((w) => ({ id: w.id, name: w.name, type: w.type })));

  const categories = await prisma.products.groupBy({ by: ["category"] });
  console.log("PRODUCT_CATEGORIES:", categories);

  const finishedCount = await prisma.products.count({ where: { category: "PRODUCT" } });
  const materialCount = await prisma.products.count({ where: { category: "MATERIAL" } });
  console.log("PRODUCT_COUNT:", finishedCount, "MATERIAL_COUNT:", materialCount);

  const finishedPackagings = await prisma.productpackagings.count({
    where: { deletedAt: null, products: { category: "PRODUCT" } },
  });
  console.log("FINISHED_PACKAGINGS:", finishedPackagings);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
