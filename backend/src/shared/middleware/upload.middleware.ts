import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Define the community uploads folder at src/public/uploads/community
const uploadDir = path.join(process.cwd(), 'src/public/uploads/community');

// Synchronously create upload path if it does not exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Create unique filename using timestamp and sanitized original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedOriginal = file.originalname.replace(/\s+/g, '_');
    cb(null, `${uniqueSuffix}_${sanitizedOriginal}`);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!') as any, false);
  }
};

export const uploadCommunityImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limit files to 10MB
  }
});

// Define the avatars uploads folder at src/public/uploads/avatars
const avatarDir = path.join(process.cwd(), 'src/public/uploads/avatars');

// Synchronously create upload path if it does not exist
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarDir);
  },
  filename: (_req, file, cb) => {
    // Create unique filename using timestamp and sanitized original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedOriginal = file.originalname.replace(/\s+/g, '_');
    cb(null, `avatar_${uniqueSuffix}_${sanitizedOriginal}`);
  }
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limit files to 5MB
  }
});
