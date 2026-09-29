import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { uploadsDirectory } from "./utils/upload.js";
import postsRoutes from "./routes/posts.routes.js";
import userRoutes from "./routes/user.routes.js"; // must match file exactly
import jobsRoutes from "./routes/jobs.routes.js";
import applicationsRoutes from "./routes/applications.routes.js";
dotenv.config();

const app = express();
app.use(express.json()); 
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by CORS"));
  },
}));

app.get("/health", (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  return res.status(databaseReady ? 200 : 503).json({ status: databaseReady ? "ok" : "starting" });
});

app.use("/posts", postsRoutes);
app.use("/jobs", jobsRoutes);
app.use("/applications", applicationsRoutes);
app.use(userRoutes);

app.use(express.static(uploadsDirectory));
console.log("successfull");

const start = async () => {
  try {
    console.log("Starting server...");

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI must be set in the backend environment");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    const port = Number(process.env.PORT || 9080);
    app.listen(port, () => {
      console.log(`App is listening on port ${port}`);
    });

  } catch (error) {
    console.error("FAILED TO START SERVER ❌");
    console.error(error);
    process.exit(1); // force visible failure
  }
};

start();