import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

export const uploadsDirectory = path.resolve(process.env.UPLOADS_DIR || fileURLToPath(new URL("../uploads/", import.meta.url)));
fs.mkdirSync(uploadsDirectory, { recursive: true });
export const privateResumesDirectory = path.resolve(process.env.PRIVATE_RESUMES_DIR || fileURLToPath(new URL("../private_uploads/resumes/", import.meta.url)));
fs.mkdirSync(privateResumesDirectory, { recursive: true });

const createStorage = (destination) => multer.diskStorage({
  destination,
  filename: (req, file, callback) => {
    callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const createUpload = (destination, allowedTypes, fileSize = 10 * 1024 * 1024) => multer({
  storage: createStorage(destination),
  limits: { fileSize },
  fileFilter: (req, file, callback) => {
    if (allowedTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("Unsupported upload file type"));
  },
});

export const profilePictureUpload = createUpload(uploadsDirectory, new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]));

export const postMediaUpload = createUpload(uploadsDirectory, new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]));

export const resumeUpload = createUpload(privateResumesDirectory, new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]), 8 * 1024 * 1024);