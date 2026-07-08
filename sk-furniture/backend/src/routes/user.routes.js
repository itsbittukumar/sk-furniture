import { Router } from "express";
import User from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Admin only: view registered customers (never expose password hashes)
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find({ role: "customer" }).select("-password -cart");
  res.json(users);
});

export default router;
