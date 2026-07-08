import mongoose from "mongoose";

const siteConfigSchema = new mongoose.Schema({
  heroTitle: { type: String, default: "Furniture built to live with, not just look at." },
  heroSubtitle: { type: String, default: "Solid wood, honest prices, delivered to your door across India." },
  saleActive: { type: Boolean, default: true },
  saleText: { type: String, default: "Monsoon Sale — up to 20% off select pieces" },
});

export default mongoose.model("SiteConfig", siteConfigSchema);
