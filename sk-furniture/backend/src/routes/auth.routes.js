import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();

function sign(user) {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return { id: user._id, username: user.username, email: user.email, role: user.role };
}

router.post("/signup", async (req, res) => {
  try {
    let { username, email, password } = req.body;
    username = (username || "").trim().toLowerCase();
    email = (email || "").trim().toLowerCase();

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields." });
    }
    if (username.length < 3) return res.status(400).json({ message: "Username must be at least 3 characters." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: "That username is already taken." });

    const hash = await bcrypt.hash(password, 10);
    // Signup always creates a customer account - admin accounts cannot be self-registered.
    const user = await User.create({ username, email, password: hash, role: "customer" });

    const token = sign(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ message: "Signup failed. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  try {
    let { username, password } = req.body;
    username = (username || "").trim().toLowerCase();

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Incorrect username or password." });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Incorrect username or password." });

    const token = sign(user);
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

export default router;
