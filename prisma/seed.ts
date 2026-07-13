import bcrypt from "bcryptjs";
import { db } from "../src/lib/yt/db";

async function main() {
  const email = process.env.SEED_USER_EMAIL ?? "admin@wemul.cl";
  const name = process.env.SEED_USER_NAME ?? "Wemul Admin";
  const password = process.env.SEED_USER_PASSWORD ?? "wemul2026";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, role: "ADMIN" },
  });

  const client = await db.client.upsert({
    where: { name: "Woki Toki" },
    update: {},
    create: { name: "Woki Toki" },
  });

  await db.channel.upsert({
    where: { clientId_name: { clientId: client.id, name: "Woki Toki" } },
    update: {},
    create: { clientId: client.id, name: "Woki Toki", handle: "@wokitoki" },
  });

  console.log(`Seeded user ${user.email} / client ${client.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
