import { Router } from "express";
import Product from "../models/Product.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Public: anyone can browse the catalog
router.get("/", async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

router.get("/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found." });
  res.json(product);
});

// Admin only: add new furniture to the catalog
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, category, price, mrp, image, description, stock, isDeal, isNew } = req.body;
  if (!name || !category || price == null) {
    return res.status(400).json({ message: "Name, category and price are required." });
  }
  const product = await Product.create({
    name, category, price, mrp: mrp || price, image: image || "", description: description || "",
    stock: stock || 0, isDeal: !!isDeal, isNew: isNew !== undefined ? !!isNew : true,
  });
  res.status(201).json(product);
});

// Admin only: edit price, stock, deal/new flags, etc.
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!product) return res.status(404).json({ message: "Product not found." });
  res.json(product);
});

// Admin only: remove a product from the catalog
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Product removed." });
});

export default router;
