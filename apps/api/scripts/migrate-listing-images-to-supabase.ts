import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "listing-images";

if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Thiếu DATABASE_URL, SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 1 }) });
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const uploadDir = join(process.cwd(), "uploads", "listings");

const mimeFor = (filename: string) => {
  const ext = extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
};

async function main() {
  const images = await prisma.listingImage.findMany({
    where: { OR: [{ url: { startsWith: "/api/v1/listing-images/" } }, { publicId: { not: null } }] },
    orderBy: { createdAt: "asc" },
  });

  let migrated = 0;
  let skipped = 0;
  let missing = 0;

  for (const image of images) {
    const localRoute = image.url.includes("/api/v1/listing-images/");
    if ((image.url.startsWith("http://") || image.url.startsWith("https://")) && !localRoute) {
      skipped += 1;
      continue;
    }

    let sourceName = image.publicId || image.url;
    if (localRoute) {
      try { sourceName = new URL(image.url, "http://localhost").pathname; } catch { sourceName = image.url; }
    }
    const filename = basename(sourceName);
    if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      skipped += 1;
      continue;
    }

    const localPath = join(uploadDir, filename);
    let buffer: Buffer;
    try {
      buffer = await readFile(localPath);
    } catch {
      console.warn(`MISSING ${localPath}`);
      missing += 1;
      continue;
    }

    const objectPath = `listings/${image.listingId}/${filename}`;
    const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
      contentType: mimeFor(filename),
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) throw new Error(`${objectPath}: ${error.message}`);

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    await prisma.listingImage.update({
      where: { id: image.id },
      data: { url: data.publicUrl, publicId: objectPath },
    });
    migrated += 1;
    console.log(`MIGRATED ${filename}`);
  }

  console.log(`Done. migrated=${migrated}, skipped=${skipped}, missing=${missing}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
