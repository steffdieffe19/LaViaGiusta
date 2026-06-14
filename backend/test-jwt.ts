import jwt from 'jsonwebtoken';
import { env } from './src/config/env.js';

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjhmYmVlYmZkLWJkZjYtNGM4YS05ZjEwLTE5ZTkzY2UxN2ZkYiIsImVtYWlsIjoibnVvdm9AdGVzdC5pdCIsImlhdCI6MTc3OTg4NzQ3NSwiZXhwIjoxNzc5ODg4Mzc1fQ.W1yLFaZYyrX89oUIe5gkNJvl2wPL5dsgY9-3Cl1RDhU";

try {
  console.log("env.JWT_SECRET is:", env.JWT_SECRET);
  const decoded = jwt.verify(token, env.JWT_SECRET);
  console.log("Decoded successfully:", decoded);
} catch (err: any) {
  console.error("Verification failed:", err.message);
}
