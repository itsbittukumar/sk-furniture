import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Product from "./models/Product.js";
import SiteConfig from "./models/SiteConfig.js";

dotenv.config();

// Reliable placeholder images (always render, no API key needed) using brand colours.
// Swap these for real product photography any time via the Admin > Add Product /
// Manage Inventory image URL field.
function img(text, bg, fg) {
  return `https://placehold.co/600x450/${bg}/${fg}?text=${encodeURIComponent(text)}&font=roboto`;
}

const WALNUT = "3E2A1E";
const CREAM = "FBF6EE";

const PRODUCTS = [
  { name: "Milano 3-Seater Sofa", category: "sofas", price: 34999, mrp: 42999, stock: 12, isDeal: true, isNew: false,
    description: "Plush fabric sofa with solid sheesham wood legs. Seats three comfortably.",
    image: img("Milano Sofa", WALNUT, CREAM) },
  { name: "Nordic Corner Sectional", category: "sofas", price: 58999, mrp: 58999, stock: 6, isDeal: false, isNew: true,
    description: "L-shaped sectional in boucle upholstery, ideal for family rooms.",
    image: img("Nordic Sectional", WALNUT, CREAM) },
  { name: "Solid Sheesham Wood Bed", category: "beds", price: 27999, mrp: 27999, stock: 8, isDeal: false, isNew: false,
    description: "Queen size bed frame carved from solid sheesham wood with under-bed storage.",
    image: img("Sheesham Bed", "5A3E2C", CREAM) },
  { name: "Upholstered Queen Bed", category: "beds", price: 31999, mrp: 38999, stock: 5, isDeal: true, isNew: false,
    description: "Tufted headboard bed with velvet finish upholstery.",
    image: img("Queen Bed", "5A3E2C", CREAM) },
  { name: "6-Seater Teakwood Dining Set", category: "dining", price: 45999, mrp: 45999, stock: 4, isDeal: false, isNew: false,
    description: "Teakwood dining table with six cushioned chairs.",
    image: img("Dining Set", "B8862B", WALNUT) },
  { name: "Round Marble Top Table", category: "dining", price: 22999, mrp: 22999, stock: 7, isDeal: false, isNew: true,
    description: "4-seater round dining table with marble finish top.",
    image: img("Marble Table", "B8862B", WALNUT) },
  { name: "Ergonomic Mesh Office Chair", category: "chairs", price: 8999, mrp: 11999, stock: 20, isDeal: true, isNew: false,
    description: "Breathable mesh back with adjustable lumbar support and armrests.",
    image: img("Office Chair", "3F5B45", CREAM) },
  { name: "Accent Lounge Chair", category: "chairs", price: 12999, mrp: 12999, stock: 9, isDeal: false, isNew: false,
    description: "Mid-century inspired lounge chair with walnut frame.",
    image: img("Lounge Chair", "3F5B45", CREAM) },
  { name: "3-Door Wardrobe", category: "storage", price: 24999, mrp: 24999, stock: 10, isDeal: false, isNew: false,
    description: "Engineered wood wardrobe with mirror panel and multiple shelves.",
    image: img("3-Door Wardrobe", "231610", CREAM) },
  { name: "Bedside Storage Cabinet", category: "storage", price: 5999, mrp: 7499, stock: 25, isDeal: true, isNew: false,
    description: "Compact two-drawer nightstand in matte walnut finish.",
    image: img("Storage Cabinet", "231610", CREAM) },
  { name: "L-Shaped Office Desk", category: "office", price: 15999, mrp: 15999, stock: 11, isDeal: false, isNew: true,
    description: "Spacious corner desk with cable management and storage drawer.",
    image: img("Office Desk", "5A3E2C", CREAM) },
  { name: "Executive Bookshelf Cabinet", category: "office", price: 13999, mrp: 13999, stock: 6, isDeal: false, isNew: false,
    description: "Tall office cabinet with glass-front shelves and locking drawers.",
    image: img("Bookshelf Cabinet", "5A3E2C", CREAM) },
  { name: "Rattan Patio Set (4 Seater)", category: "outdoor", price: 28999, mrp: 34999, stock: 5, isDeal: true, isNew: false,
    description: "Weather-resistant rattan sofa set with cushions for balcony or garden.",
    image: img("Patio Set", "3F5B45", CREAM) },
  { name: "Wooden Garden Bench", category: "outdoor", price: 7999, mrp: 7999, stock: 14, isDeal: false, isNew: false,
    description: "Teakwood outdoor bench, treated for weather resistance.",
    image: img("Garden Bench", "3F5B45", CREAM) },
  { name: "5-Tier Ladder Bookshelf", category: "bookshelf", price: 6999, mrp: 6999, stock: 18, isDeal: false, isNew: false,
    description: "Leaning ladder-style bookshelf, space-saving and sturdy.",
    image: img("Ladder Bookshelf", "B8862B", WALNUT) },
  { name: "Modular Wall Bookshelf", category: "bookshelf", price: 9999, mrp: 9999, stock: 13, isDeal: false, isNew: true,
    description: "Honeycomb modular shelving unit, wall-mounted.",
    image: img("Wall Bookshelf", "B8862B", WALNUT) },
  { name: "Industrial Floor Lamp", category: "decor", price: 3499, mrp: 4499, stock: 22, isDeal: true, isNew: false,
    description: "Matte black floor lamp with adjustable arm, industrial style.",
    image: img("Floor Lamp", "231610", CREAM) },
  { name: "Wall Mirror with Wooden Frame", category: "decor", price: 2999, mrp: 2999, stock: 16, isDeal: false, isNew: false,
    description: "Round wall mirror framed in natural mango wood.",
    image: img("Wall Mirror", "231610", CREAM) },
];

async function run() {
  await connectDB();

  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin@123";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@skfurniture.com";

  const existingAdmin = await User.findOne({ username: adminUsername });
  if (!existingAdmin) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await User.create({ username: adminUsername, email: adminEmail, password: hash, role: "admin" });
    console.log(`Created admin user "${adminUsername}"`);
  } else {
    console.log(`Admin user "${adminUsername}" already exists, skipping.`);
  }

  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany(PRODUCTS);
    console.log(`Seeded ${PRODUCTS.length} products.`);
  } else {
    console.log(`Products already exist (${productCount}), skipping seed.`);
  }

  const configCount = await SiteConfig.countDocuments();
  if (configCount === 0) {
    await SiteConfig.create({});
    console.log("Created default site config.");
  }

  console.log("Seeding complete.");
  process.exit(0);
}

run().catch((e) => {
  console.error("Seeding failed:", e);
  process.exit(1);
});
