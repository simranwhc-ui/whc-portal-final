import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import connectDB from "./config/db.js";
import User from "./models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.join(__dirname, ".env"),
});

async function seedAdmin() {
  const { MONGO_URI, SEED_ADMIN_NAME, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD } = process.env;

  if (!MONGO_URI) throw new Error("MONGO_URI is missing in backend/.env");
  if (!SEED_ADMIN_NAME || !SEED_ADMIN_USERNAME || !SEED_ADMIN_PASSWORD) {
    throw new Error("SEED_ADMIN_NAME, SEED_ADMIN_USERNAME, and SEED_ADMIN_PASSWORD are required.");
  }
  if (SEED_ADMIN_PASSWORD.length < 6) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 6 characters.");
  }

  await connectDB();

  const username = SEED_ADMIN_USERNAME.trim().toLowerCase();
  const existingUser = await User.findOne({ username });

  if (existingUser) {
    if (existingUser.role !== "admin") {
      throw new Error(`Username "${username}" already belongs to a non-admin account.`);
    }

    console.log(`Admin account "${username}" already exists; no records were changed.`);
    return;
  }

  const adminData = {
    name: SEED_ADMIN_NAME.trim(),
    username,
    password: await bcrypt.hash(SEED_ADMIN_PASSWORD, 12),
    role: "admin",
    status: "active",
  };
  if (process.env.SEED_ADMIN_EMAIL?.trim()) {
    adminData.email = process.env.SEED_ADMIN_EMAIL.trim().toLowerCase();
  }
  if (process.env.SEED_ADMIN_PHONE?.trim()) {
    adminData.phone = process.env.SEED_ADMIN_PHONE.trim();
  }

  await User.create(adminData);
  console.log(`Created admin account "${username}".`);
}

seedAdmin()
  .catch((error) => {
    console.error("Admin bootstrap failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
