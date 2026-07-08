import { Router } from "express";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Checkout: turn the logged-in customer's cart into an order
router.post("/checkout", requireAuth, async (req, res) => {
  if (req.user.role === "admin") return res.status(403).json({ message: "Admin accounts can't place orders." });

  const user = await User.findById(req.user.id).populate("cart.product");
  const items = (user.cart || []).filter((i) => i.product).map((i) => ({
    productId: i.product._id, name: i.product.name, qty: i.qty, price: i.product.price,
  }));
  if (items.length === 0) return res.status(400).json({ message: "Your cart is empty." });

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const order = await Order.create({ username: user.username, items, total });

  user.cart = [];
  await user.save();

  res.status(201).json(order);
});

// Customer: view my own past orders
router.get("/mine", requireAuth, async (req, res) => {
  const orders = await Order.find({ username: req.user.username }).sort({ createdAt: -1 });
  res.json(orders);
});

// Admin only: view every order placed on the store
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

export default router;
