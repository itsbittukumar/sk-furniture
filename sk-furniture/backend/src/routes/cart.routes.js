import { Router } from "express";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function populatedCart(userId) {
  const user = await User.findById(userId).populate("cart.product");
  return (user.cart || []).filter((i) => i.product).map((i) => ({
    productId: i.product._id,
    qty: i.qty,
    product: i.product,
  }));
}

router.get("/", requireAuth, async (req, res) => {
  if (req.user.role === "admin") return res.json([]);
  res.json(await populatedCart(req.user.id));
});

router.post("/", requireAuth, async (req, res) => {
  if (req.user.role === "admin") return res.status(403).json({ message: "Admin accounts can't shop." });
  const { productId, qty = 1 } = req.body;
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found." });

  const user = await User.findById(req.user.id);
  const existing = user.cart.find((i) => i.product.toString() === productId);
  if (existing) existing.qty += qty;
  else user.cart.push({ product: productId, qty });
  await user.save();
  res.json(await populatedCart(req.user.id));
});

router.put("/:productId", requireAuth, async (req, res) => {
  const { qty } = req.body;
  const user = await User.findById(req.user.id);
  if (qty <= 0) {
    user.cart = user.cart.filter((i) => i.product.toString() !== req.params.productId);
  } else {
    const item = user.cart.find((i) => i.product.toString() === req.params.productId);
    if (item) item.qty = qty;
  }
  await user.save();
  res.json(await populatedCart(req.user.id));
});

router.delete("/:productId", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.cart = user.cart.filter((i) => i.product.toString() !== req.params.productId);
  await user.save();
  res.json(await populatedCart(req.user.id));
});

export default router;
