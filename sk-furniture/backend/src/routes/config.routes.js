import { Router } from "express";
import SiteConfig from "../models/SiteConfig.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  let config = await SiteConfig.findOne();
  if (!config) config = await SiteConfig.create({});
  res.json(config);
});

// Admin only: edit homepage headline, subtext, sale banner
router.put("/", requireAuth, requireAdmin, async (req, res) => {
  let config = await SiteConfig.findOne();
  if (!config) config = new SiteConfig();
  Object.assign(config, req.body);
  await config.save();
  res.json(config);
});

export default router;
