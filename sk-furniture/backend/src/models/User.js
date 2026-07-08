import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3 },
  email: { type: String, required: true, trim: true, lowercase: true },
  password: { type: String, required: true }, // bcrypt hash
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  cart: { type: [cartItemSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
