import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    enum: ["sofas", "beds", "dining", "chairs", "storage", "office", "outdoor", "tables", "bookshelf", "decor"],
  },
  price: { type: Number, required: true, min: 0 },
  mrp: { type: Number, default: 0 },
  image: { type: String, default: "" },
  description: { type: String, default: "" },
  stock: { type: Number, default: 0, min: 0 },
  isDeal: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Product", productSchema);
