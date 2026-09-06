import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const amenities = [
  ["AIR_CONDITIONER", "Máy lạnh", "ROOM"],
  ["WASHING_MACHINE", "Máy giặt", "BUILDING"],
  ["PRIVATE_BATHROOM", "WC riêng", "ROOM"],
  ["PARKING", "Chỗ để xe", "BUILDING"],
  ["BALCONY", "Ban công", "ROOM"],
  ["MEZZANINE", "Gác xép", "ROOM"],
  ["KITCHEN", "Khu bếp", "ROOM"],
  ["FREE_HOURS", "Giờ giấc tự do", "POLICY"],
  ["SECURITY_CAMERA", "Camera an ninh", "SECURITY"],
  ["FINGERPRINT_LOCK", "Khóa vân tay", "SECURITY"]
] as const;

async function main() {
  for (const [code, name, category] of amenities) {
    await prisma.amenity.upsert({
      where: { code },
      update: { name, category },
      create: { code, name, category },
    });
  }
  console.log(`Seeded ${amenities.length} amenities.`);
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
