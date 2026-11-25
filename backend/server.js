
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import connectDB from "./config/db.js";
import app from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Always load backend/.env, regardless of the terminal's working directory.
dotenv.config({
  path: path.join(__dirname, ".env"),
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing. Check backend/.env");
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing. Check backend/.env");
    process.exit(1);
  }

  await connectDB();

  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
};

startServer();
