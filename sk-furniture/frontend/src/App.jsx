import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Sofa, BedDouble, UtensilsCrossed, Armchair, Package, Briefcase, TreePine,
  Table2, BookOpen, Lamp, ShoppingCart, User, LogOut, Plus, Minus, Trash2,
  Search, Percent, Tag, LayoutDashboard, Settings, Menu, X, Check, ChevronLeft,
  Edit2, Users as UsersIcon, Receipt
} from "lucide-react";
import { api } from "./api.js";

/* ---------------------------------- THEME ---------------------------------- */
const T = {
  walnutDark: "#231610",
  walnut: "#3E2A1E",
  walnutLight: "#5A3E2C",
  cream: "#FBF6EE",
  creamDeep: "#F3E9D8",
  sand: "#E7D9C1",
  brass: "#B8862B",
  brassLight: "#D3A94F",
  forest: "#3F5B45",
  forestLight: "#E7EEE7",
  charcoal: "#26201B",
  charcoalSoft: "#5C5148",
  danger: "#9C3B3B",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap');
.sk-display { font-family: 'Fraunces', serif; }
.sk-body { font-family: 'Work Sans', sans-serif; }
.sk-tag { clip-path: polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%); }
.sk-scroll::-webkit-scrollbar { height: 6px; }
.sk-scroll::-webkit-scrollbar-thumb { background: ${T.sand}; border-radius: 4px; }
`;

const CATEGORIES = [
  { id: "sofas", name: "Sofas & Couches", icon: Sofa },
  { id: "beds", name: "Beds", icon: BedDouble },
  { id: "dining", name: "Dining Tables", icon: UtensilsCrossed },
  { id: "chairs", name: "Chairs", icon: Armchair },
  { id: "storage", name: "Wardrobes & Storage", icon: Package },
  { id: "office", name: "Office Furniture", icon: Briefcase },
  { id: "outdoor", name: "Outdoor Furniture", icon: TreePine },
  { id: "tables", name: "Coffee & Side Tables", icon: Table2 },
  { id: "bookshelf", name: "Bookshelves", icon: BookOpen },
  { id: "decor", name: "Decor & Lighting", icon: Lamp },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const INR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

/* ---------------------------------- APP ---------------------------------- */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [siteConfig, setSiteConfig] = useState({});
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);

  const [currentUser, setCurrentUser] = useState(() => {
    const raw = localStorage.getItem("sk_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [view, setView] = useState("store");
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [authError, setAuthError] = useState("");

  const isAdmin = currentUser?.role === "admin";

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const loadPublicData = useCallback(async () => {
    const [prods, config] = await Promise.all([api.getProducts(), api.getConfig()]);
    setProducts(prods);
    setSiteConfig(config);
  }, []);

  const loadCart = useCallback(async () => {
    if (!currentUser || currentUser.role === "admin") return setCart([]);
    try {
      setCart(await api.getCart());
    } catch (e) {
      setCart([]);
    }
  }, [currentUser]);

  useEffect(() => {
    (async () => {
      try {
        await loadPublicData();
      } catch (e) {
        showToast("Could not reach the server. Check the API is running.");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + (i.product?.price || 0) * i.qty, 0);

  /* ------------------------------- AUTH ------------------------------- */
  async function handleSignup(username, password, email) {
    setAuthError("");
    try {
      const { token, user } = await api.signup(username, email, password);
      localStorage.setItem("sk_token", token);
      localStorage.setItem("sk_user", JSON.stringify(user));
      setCurrentUser(user);
      setView("store");
      showToast(`Welcome to SK Furniture, ${user.username}!`);
    } catch (e) {
      setAuthError(e.message);
    }
  }

  async function handleLogin(username, password) {
    setAuthError("");
    try {
      const { token, user } = await api.login(username, password);
      localStorage.setItem("sk_token", token);
      localStorage.setItem("sk_user", JSON.stringify(user));
      setCurrentUser(user);
      setView(user.role === "admin" ? "admin" : "store");
      showToast(`Welcome back, ${user.username}!`);
    } catch (e) {
      setAuthError(e.message);
    }
  }

  function handleLogout() {
    localStorage.removeItem("sk_token");
    localStorage.removeItem("sk_user");
    setCurrentUser(null);
    setCart([]);
    setView("store");
    showToast("Logged out.");
  }

  /* ------------------------------- CART ------------------------------- */
  function requireLogin() {
    showToast("Please log in to continue.");
    setView("login");
  }

  async function addToCart(product) {
    if (!currentUser) return requireLogin();
    if (isAdmin) return showToast("Admin accounts can't shop. Log in as a customer.");
    try {
      setCart(await api.addToCart(product._id, 1));
      showToast(`${product.name} added to cart.`);
    } catch (e) {
      showToast(e.message);
    }
  }

  async function changeQty(productId, delta) {
    const item = cart.find((i) => i.productId === productId);
    const nextQty = (item?.qty || 0) + delta;
    try {
      setCart(await api.setCartQty(productId, nextQty));
    } catch (e) {
      showToast(e.message);
    }
  }

  async function removeFromCart(productId) {
    try {
      setCart(await api.removeFromCart(productId));
    } catch (e) {
      showToast(e.message);
    }
  }

  async function checkout() {
    try {
      await api.checkout();
      setCart([]);
      showToast("Order placed! Thank you for shopping with SK Furniture.");
      setView("store");
    } catch (e) {
      showToast(e.message);
    }
  }

  /* ------------------------------- ADMIN ------------------------------- */
  async function addProduct(p) {
    try {
      const created = await api.addProduct(p);
      setProducts((prev) => [created, ...prev]);
      showToast(`${p.name} added to catalog.`);
    } catch (e) {
      showToast(e.message);
    }
  }

  async function updateProduct(id, changes) {
    try {
      const updated = await api.updateProduct(id, changes);
      setProducts((prev) => prev.map((p) => (p._id === id ? updated : p)));
    } catch (e) {
      showToast(e.message);
    }
  }

  async function deleteProduct(id) {
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p._id !== id));
      showToast("Product removed.");
    } catch (e) {
      showToast(e.message);
    }
  }

  async function saveSiteConfig(next) {
    try {
      const updated = await api.saveConfig(next);
      setSiteConfig(updated);
      showToast("Storefront updated.");
    } catch (e) {
      showToast(e.message);
    }
  }

  async function loadAdminExtras() {
    try {
      const [c, o] = await Promise.all([api.getCustomers(), api.getAllOrders()]);
      setCustomers(c);
      setOrders(o);
    } catch (e) {
      showToast(e.message);
    }
  }

  useEffect(() => {
    if (view === "admin" && isAdmin) loadAdminExtras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isAdmin]);

  /* ------------------------------- FILTERED LIST ------------------------------- */
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === "all" || p.category === activeCategory;
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchTerm]);

  const dealsProducts = products.filter((p) => p.isDeal);
  const selectedProduct = products.find((p) => p._id === selectedProductId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center sk-body" style={{ background: T.cream }}>
        <style>{FONTS}</style>
        <div className="text-center">
          <div className="sk-display text-2xl mb-2" style={{ color: T.walnut }}>SK FURNITURE</div>
          <div className="text-sm" style={{ color: T.charcoalSoft }}>Setting up the showroom…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen sk-body" style={{ background: T.cream, color: T.charcoal }}>
      <style>{FONTS}</style>

      {/* ---------- HEADER ---------- */}
      <header className="sticky top-0 z-30" style={{ background: T.walnutDark }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => { setView("store"); setActiveCategory("all"); setMobileNavOpen(false); }}
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center sk-display font-semibold" style={{ background: T.brass, color: T.walnutDark }}>SK</div>
              <span className="sk-display text-xl tracking-wide text-white">SK FURNITURE</span>
            </button>

            <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
              <div className="relative w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.charcoalSoft }} />
                <input
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setView("store"); }}
                  placeholder="Search furniture…"
                  className="w-full pl-9 pr-3 py-2 rounded-full text-sm outline-none"
                  style={{ background: T.cream }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isAdmin && (
                <button onClick={() => (currentUser ? setView("cart") : requireLogin())} className="relative p-2 rounded-full" style={{ color: T.cream }} title="Cart">
                  <ShoppingCart size={20} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ background: T.brass, color: T.walnutDark }}>
                      {cartCount}
                    </span>
                  )}
                </button>
              )}

              {currentUser ? (
                <div className="hidden md:flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={() => setView("admin")} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: T.brass, color: T.walnutDark }}>
                      <LayoutDashboard size={14} /> Admin
                    </button>
                  )}
                  <span className="text-sm px-2" style={{ color: T.sand }}>Hi, {currentUser.username}</span>
                  <button onClick={handleLogout} className="p-2 rounded-full" style={{ color: T.cream }} title="Log out">
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setView("login")} className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: T.brass, color: T.walnutDark }}>
                  <User size={14} /> Log in
                </button>
              )}

              <button className="md:hidden p-2" style={{ color: T.cream }} onClick={() => setMobileNavOpen((v) => !v)}>
                {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t" style={{ borderColor: T.walnutLight }}>
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto sk-scroll">
            <CatChip active={activeCategory === "all"} onClick={() => { setActiveCategory("all"); setView("store"); }} label="All" />
            {CATEGORIES.map((c) => (
              <CatChip key={c.id} active={activeCategory === c.id} onClick={() => { setActiveCategory(c.id); setView("store"); }} label={c.name} Icon={c.icon} />
            ))}
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden px-4 pb-4 flex flex-col gap-2" style={{ background: T.walnutDark }}>
            <input
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setView("store"); }}
              placeholder="Search furniture…"
              className="w-full px-3 py-2 rounded-full text-sm outline-none mb-1"
              style={{ background: T.cream }}
            />
            {currentUser ? (
              <>
                {isAdmin && (
                  <button onClick={() => { setView("admin"); setMobileNavOpen(false); }} className="text-left py-2 text-sm font-medium" style={{ color: T.brassLight }}>Admin dashboard</button>
                )}
                <button onClick={handleLogout} className="text-left py-2 text-sm" style={{ color: T.cream }}>Log out ({currentUser.username})</button>
              </>
            ) : (
              <>
                <button onClick={() => { setView("login"); setMobileNavOpen(false); }} className="text-left py-2 text-sm font-medium" style={{ color: T.brassLight }}>Log in</button>
                <button onClick={() => { setView("signup"); setMobileNavOpen(false); }} className="text-left py-2 text-sm" style={{ color: T.cream }}>Sign up</button>
              </>
            )}
          </div>
        )}
      </header>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm shadow-lg flex items-center gap-2" style={{ background: T.walnutDark, color: T.cream }}>
          <Check size={14} style={{ color: T.brassLight }} /> {toast}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 pb-16">
        {view === "store" && (
          <StoreView
            siteConfig={siteConfig}
            dealsProducts={dealsProducts}
            filteredProducts={filteredProducts}
            activeCategory={activeCategory}
            searchTerm={searchTerm}
            onSelect={(id) => { setSelectedProductId(id); setView("product"); }}
            onAddToCart={addToCart}
            isAdmin={isAdmin}
          />
        )}

        {view === "product" && selectedProduct && (
          <ProductView product={selectedProduct} onBack={() => setView("store")} onAddToCart={addToCart} isAdmin={isAdmin} />
        )}

        {view === "cart" && currentUser && !isAdmin && (
          <CartView items={cart} total={cartTotal} onQty={changeQty} onRemove={removeFromCart} onCheckout={checkout} onBrowse={() => setView("store")} />
        )}

        {view === "login" && <AuthView mode="login" error={authError} onSubmit={handleLogin} onSwitch={() => { setAuthError(""); setView("signup"); }} />}
        {view === "signup" && <AuthView mode="signup" error={authError} onSubmit={handleSignup} onSwitch={() => { setAuthError(""); setView("login"); }} />}

        {view === "admin" && isAdmin && (
          <AdminView
            products={products}
            siteConfig={siteConfig}
            customers={customers}
            orders={orders}
            onAddProduct={addProduct}
            onUpdateProduct={updateProduct}
            onDeleteProduct={deleteProduct}
            onSaveConfig={saveSiteConfig}
          />
        )}

        {view === "admin" && !isAdmin && (
          <div className="py-24 text-center">
            <p className="sk-display text-xl mb-2" style={{ color: T.walnut }}>Admin access only</p>
            <p className="text-sm" style={{ color: T.charcoalSoft }}>You don't have permission to view this page.</p>
          </div>
        )}
      </main>

      <footer className="py-8" style={{ background: T.walnutDark, color: T.sand }}>
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <div className="sk-display text-lg mb-1" style={{ color: T.brassLight }}>SK FURNITURE</div>
          <p>Solid wood. Honest prices. Made for real homes.</p>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------- SUBCOMPONENTS ---------------------------------- */

function CatChip({ active, onClick, label, Icon }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
      style={{ background: active ? T.brass : "transparent", color: active ? T.walnutDark : T.sand, border: `1px solid ${active ? T.brass : T.walnutLight}` }}
    >
      {Icon && <Icon size={13} />}
      {label}
    </button>
  );
}

function ProductThumb({ product, size = "normal" }) {
  const cat = CAT_MAP[product.category];
  const Icon = cat ? cat.icon : Package;
  const h = size === "large" ? "h-72" : "h-40";
  const [failed, setFailed] = useState(false);

  if (product.image && !failed) {
    return (
      <div className={`w-full ${h} rounded-t-xl overflow-hidden`} style={{ background: T.creamDeep }}>
        <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className={`w-full ${h} rounded-t-xl flex items-center justify-center`} style={{ background: T.creamDeep }}>
      <Icon size={size === "large" ? 72 : 44} strokeWidth={1.2} style={{ color: T.walnutLight }} />
    </div>
  );
}

function PriceTag({ price, mrp }) {
  const hasDiscount = mrp && mrp > price;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="sk-tag inline-flex items-center gap-1 pl-2 pr-3 py-1 text-sm font-semibold" style={{ background: T.forest, color: T.forestLight }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.forestLight }} />
        {INR(price)}
      </span>
      {hasDiscount && <span className="text-xs line-through" style={{ color: T.charcoalSoft }}>{INR(mrp)}</span>}
    </div>
  );
}

function ProductCard({ product, onSelect, onAddToCart, isAdmin }) {
  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: "#fff", border: `1px solid ${T.sand}` }}>
      <button onClick={onSelect} className="text-left">
        <div className="relative">
          <ProductThumb product={product} />
          {product.isDeal && <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: T.brass, color: T.walnutDark }}>DEAL</span>}
          {product.isNew && !product.isDeal && <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: T.forest, color: "#fff" }}>NEW</span>}
        </div>
        <div className="p-3">
          <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: T.charcoalSoft }}>{CAT_MAP[product.category]?.name}</p>
          <p className="font-medium text-sm mb-2 leading-snug" style={{ color: T.charcoal }}>{product.name}</p>
          <PriceTag price={product.price} mrp={product.mrp} />
        </div>
      </button>
      {!isAdmin && (
        <div className="px-3 pb-3 mt-auto">
          <button
            onClick={() => onAddToCart(product)}
            disabled={product.stock <= 0}
            className="w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: T.walnutDark, color: T.cream }}
          >
            <ShoppingCart size={14} /> {product.stock <= 0 ? "Out of stock" : "Add to cart"}
          </button>
        </div>
      )}
    </div>
  );
}

function StoreView({ siteConfig, dealsProducts, filteredProducts, activeCategory, searchTerm, onSelect, onAddToCart, isAdmin }) {
  return (
    <div>
      <section className="mt-6 rounded-2xl overflow-hidden relative" style={{ background: T.walnut }}>
        <div className="px-6 py-12 md:px-12 md:py-16 max-w-2xl relative z-10">
          {siteConfig.saleActive && (
            <span className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: T.brass, color: T.walnutDark }}>
              <Percent size={12} /> {siteConfig.saleText}
            </span>
          )}
          <h1 className="sk-display text-3xl md:text-5xl leading-tight mb-4" style={{ color: T.cream }}>{siteConfig.heroTitle}</h1>
          <p className="text-sm md:text-base" style={{ color: T.sand }}>{siteConfig.heroSubtitle}</p>
        </div>
        <Sofa size={220} strokeWidth={0.6} className="hidden md:block absolute -right-6 -bottom-10 opacity-20" style={{ color: T.brassLight }} />
      </section>

      {activeCategory === "all" && !searchTerm && dealsProducts.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={18} style={{ color: T.brass }} />
            <h2 className="sk-display text-xl" style={{ color: T.walnut }}>Today's Deals</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto sk-scroll pb-2">
            {dealsProducts.map((p) => (
              <div key={p._id} className="w-56 flex-shrink-0">
                <ProductCard product={p} onSelect={() => onSelect(p._id)} onAddToCart={onAddToCart} isAdmin={isAdmin} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="sk-display text-xl mb-4" style={{ color: T.walnut }}>
          {searchTerm ? `Results for "${searchTerm}"` : activeCategory === "all" ? "Full Catalog" : CAT_MAP[activeCategory]?.name}
        </h2>
        {filteredProducts.length === 0 ? (
          <p className="text-sm py-12 text-center" style={{ color: T.charcoalSoft }}>No furniture matches that search yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => (
              <ProductCard key={p._id} product={p} onSelect={() => onSelect(p._id)} onAddToCart={onAddToCart} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProductView({ product, onBack, onAddToCart, isAdmin }) {
  return (
    <div className="mt-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: T.charcoalSoft }}>
        <ChevronLeft size={16} /> Back to catalog
      </button>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.sand}` }}>
          <ProductThumb product={product} size="large" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: T.charcoalSoft }}>{CAT_MAP[product.category]?.name}</p>
          <h1 className="sk-display text-2xl md:text-3xl mb-3" style={{ color: T.walnut }}>{product.name}</h1>
          <div className="mb-4"><PriceTag price={product.price} mrp={product.mrp} /></div>
          <p className="text-sm leading-relaxed mb-6" style={{ color: T.charcoalSoft }}>{product.description}</p>
          <p className="text-xs mb-6" style={{ color: product.stock > 0 ? T.forest : T.danger }}>
            {product.stock > 0 ? `${product.stock} in stock` : "Currently out of stock"}
          </p>
          {!isAdmin && (
            <button onClick={() => onAddToCart(product)} disabled={product.stock <= 0} className="px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-40" style={{ background: T.walnutDark, color: T.cream }}>
              <ShoppingCart size={16} /> Add to cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CartView({ items, total, onQty, onRemove, onCheckout, onBrowse }) {
  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <ShoppingCart size={40} className="mx-auto mb-3" style={{ color: T.sand }} />
        <p className="sk-display text-xl mb-2" style={{ color: T.walnut }}>Your cart is empty</p>
        <button onClick={onBrowse} className="mt-3 px-5 py-2 rounded-full text-sm font-medium" style={{ background: T.walnutDark, color: T.cream }}>Browse furniture</button>
      </div>
    );
  }
  return (
    <div className="mt-8 grid md:grid-cols-3 gap-8">
      <div className="md:col-span-2 flex flex-col gap-3">
        <h1 className="sk-display text-2xl mb-2" style={{ color: T.walnut }}>Your Cart</h1>
        {items.map((i) => (
          <div key={i.productId} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${T.sand}` }}>
            <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden"><ProductThumb product={i.product} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{i.product.name}</p>
              <PriceTag price={i.product.price} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onQty(i.productId, -1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: T.creamDeep }}><Minus size={13} /></button>
              <span className="text-sm w-5 text-center">{i.qty}</span>
              <button onClick={() => onQty(i.productId, 1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: T.creamDeep }}><Plus size={13} /></button>
            </div>
            <button onClick={() => onRemove(i.productId)} style={{ color: T.danger }}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <div className="h-fit p-5 rounded-xl" style={{ background: T.walnut }}>
        <h2 className="sk-display text-lg mb-4" style={{ color: T.cream }}>Order Summary</h2>
        <div className="flex justify-between text-sm mb-2" style={{ color: T.sand }}><span>Subtotal</span><span>{INR(total)}</span></div>
        <div className="flex justify-between text-sm mb-4" style={{ color: T.sand }}><span>Delivery</span><span>Free</span></div>
        <div className="flex justify-between font-semibold mb-5" style={{ color: T.cream }}><span>Total</span><span>{INR(total)}</span></div>
        <button onClick={onCheckout} className="w-full py-3 rounded-lg text-sm font-medium" style={{ background: T.brass, color: T.walnutDark }}>Place order</button>
      </div>
    </div>
  );
}

function AuthView({ mode, error, onSubmit, onSwitch }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const isLogin = mode === "login";

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center sk-display font-semibold" style={{ background: T.brass, color: T.walnutDark }}>SK</div>
        <h1 className="sk-display text-2xl" style={{ color: T.walnut }}>{isLogin ? "Log in" : "Create your account"}</h1>
        <p className="text-xs mt-1" style={{ color: T.charcoalSoft }}>
          {isLogin ? "New here?" : "Already shopping with us?"}{" "}
          <button onClick={onSwitch} className="underline font-medium" style={{ color: T.brass }}>{isLogin ? "Sign up" : "Log in"}</button>
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); isLogin ? onSubmit(username, password) : onSubmit(username, password, email); }}
        className="flex flex-col gap-3 p-6 rounded-xl"
        style={{ background: "#fff", border: `1px solid ${T.sand}` }}
      >
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: T.charcoalSoft }}>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: T.cream }} required />
        </div>
        {!isLogin && (
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: T.charcoalSoft }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: T.cream }} required />
          </div>
        )}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: T.charcoalSoft }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: T.cream }} required />
        </div>
        {error && <p className="text-xs" style={{ color: T.danger }}>{error}</p>}
        <button type="submit" className="mt-2 w-full py-2.5 rounded-lg text-sm font-medium" style={{ background: T.walnutDark, color: T.cream }}>{isLogin ? "Log in" : "Sign up"}</button>
      </form>
      {isLogin && (
        <p className="text-[11px] text-center mt-4" style={{ color: T.charcoalSoft }}>
          Admin demo login — username <b>admin</b>, password <b>admin@123</b> (change this after first deploy)
        </p>
      )}
    </div>
  );
}

/* ------------------------------- ADMIN ------------------------------- */

function AdminView({ products, siteConfig, customers, orders, onAddProduct, onUpdateProduct, onDeleteProduct, onSaveConfig }) {
  const [tab, setTab] = useState("add");
  const tabs = [
    { id: "add", label: "Add Product", icon: Plus },
    { id: "inventory", label: "Manage Inventory", icon: Package },
    { id: "settings", label: "Storefront Settings", icon: Settings },
    { id: "users", label: "Customers", icon: UsersIcon },
    { id: "orders", label: "Orders", icon: Receipt },
  ];
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-6">
        <LayoutDashboard size={20} style={{ color: T.brass }} />
        <h1 className="sk-display text-2xl" style={{ color: T.walnut }}>Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Products" value={products.length} />
        <StatCard label="Registered customers" value={customers.length} />
        <StatCard label="Revenue" value={INR(revenue)} />
      </div>

      <div className="flex gap-2 overflow-x-auto sk-scroll mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium flex-shrink-0"
            style={{ background: tab === t.id ? T.walnutDark : "#fff", color: tab === t.id ? T.cream : T.charcoal, border: `1px solid ${T.sand}` }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "add" && <AddProductForm onAdd={onAddProduct} />}
      {tab === "inventory" && <InventoryTable products={products} onUpdate={onUpdateProduct} onDelete={onDeleteProduct} />}
      {tab === "settings" && <StorefrontSettings config={siteConfig} onSave={onSaveConfig} />}
      {tab === "users" && <CustomerList customers={customers} />}
      {tab === "orders" && <OrdersList orders={orders} />}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: "#fff", border: `1px solid ${T.sand}` }}>
      <p className="text-xs mb-1" style={{ color: T.charcoalSoft }}>{label}</p>
      <p className="sk-display text-xl" style={{ color: T.walnut }}>{value}</p>
    </div>
  );
}

function AddProductForm({ onAdd }) {
  const [form, setForm] = useState({ name: "", category: CATEGORIES[0].id, price: "", mrp: "", stock: "", image: "", description: "", isDeal: false, isNew: true });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e) {
    e.preventDefault();
    if (!form.name || !form.price) return;
    onAdd({ ...form, price: Number(form.price), mrp: Number(form.mrp || form.price), stock: Number(form.stock || 0) });
    setForm({ name: "", category: form.category, price: "", mrp: "", stock: "", image: "", description: "", isDeal: false, isNew: true });
  }

  return (
    <form onSubmit={submit} className="p-6 rounded-xl grid md:grid-cols-2 gap-4" style={{ background: "#fff", border: `1px solid ${T.sand}` }}>
      <Field label="Furniture name">
        <input value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} required />
      </Field>
      <Field label="Category">
        <select value={form.category} onChange={(e) => set("category", e.target.value)} style={inputStyle}>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Price (₹)"><input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} style={inputStyle} required /></Field>
      <Field label="MRP / strike-through price (₹, optional)"><input type="number" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} style={inputStyle} /></Field>
      <Field label="Stock quantity"><input type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} style={inputStyle} /></Field>
      <Field label="Image URL (a real photo — falls back to an icon if blank or unreachable)">
        <input value={form.image} onChange={(e) => set("image", e.target.value)} style={inputStyle} placeholder="https://…" />
      </Field>
      <Field label="Description" full><textarea value={form.description} onChange={(e) => set("description", e.target.value)} style={{ ...inputStyle, minHeight: 80 }} /></Field>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDeal} onChange={(e) => set("isDeal", e.target.checked)} /> Mark as today's deal</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isNew} onChange={(e) => set("isNew", e.target.checked)} /> Mark as new arrival</label>
      </div>
      <div className="md:col-span-2">
        <button type="submit" className="px-6 py-2.5 rounded-lg text-sm font-medium" style={{ background: T.walnutDark, color: T.cream }}>Post furniture to store</button>
      </div>
    </form>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-xs font-medium mb-1 block" style={{ color: T.charcoalSoft }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { background: "#FBF6EE", width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14, outline: "none", border: "1px solid " + T.sand };

function InventoryTable({ products, onUpdate, onDelete }) {
  const [editing, setEditing] = useState({});

  function startEdit(p) {
    setEditing((e) => ({ ...e, [p._id]: { price: p.price, mrp: p.mrp, stock: p.stock } }));
  }
  function save(id) {
    onUpdate(id, { price: Number(editing[id].price), mrp: Number(editing[id].mrp), stock: Number(editing[id].stock) });
    setEditing((e) => { const c = { ...e }; delete c[id]; return c; });
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${T.sand}` }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: T.creamDeep }}>
              {["Product", "Category", "Price", "MRP", "Stock", "Deal", "New", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: T.charcoalSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isEditing = editing[p._id];
              return (
                <tr key={p._id} style={{ borderTop: `1px solid ${T.sand}` }}>
                  <td className="px-3 py-2 max-w-[160px] truncate">{p.name}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: T.charcoalSoft }}>{CAT_MAP[p.category]?.name}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="number" value={isEditing.price} onChange={(e) => setEditing((s) => ({ ...s, [p._id]: { ...s[p._id], price: e.target.value } }))} className="w-20 px-2 py-1 rounded" style={{ border: `1px solid ${T.sand}` }} />
                    ) : INR(p.price)}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="number" value={isEditing.mrp} onChange={(e) => setEditing((s) => ({ ...s, [p._id]: { ...s[p._id], mrp: e.target.value } }))} className="w-20 px-2 py-1 rounded" style={{ border: `1px solid ${T.sand}` }} />
                    ) : INR(p.mrp)}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="number" value={isEditing.stock} onChange={(e) => setEditing((s) => ({ ...s, [p._id]: { ...s[p._id], stock: e.target.value } }))} className="w-16 px-2 py-1 rounded" style={{ border: `1px solid ${T.sand}` }} />
                    ) : p.stock}
                  </td>
                  <td className="px-3 py-2"><input type="checkbox" checked={p.isDeal} onChange={(e) => onUpdate(p._id, { isDeal: e.target.checked })} /></td>
                  <td className="px-3 py-2"><input type="checkbox" checked={p.isNew} onChange={(e) => onUpdate(p._id, { isNew: e.target.checked })} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {isEditing ? (
                        <button onClick={() => save(p._id)} className="p-1.5 rounded" style={{ background: T.forest, color: "#fff" }}><Check size={13} /></button>
                      ) : (
                        <button onClick={() => startEdit(p)} className="p-1.5 rounded" style={{ background: T.creamDeep }}><Edit2 size={13} /></button>
                      )}
                      <button onClick={() => onDelete(p._id)} className="p-1.5 rounded" style={{ background: T.creamDeep, color: T.danger }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StorefrontSettings({ config, onSave }) {
  const [form, setForm] = useState(config);
  useEffect(() => setForm(config), [config]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="p-6 rounded-xl flex flex-col gap-4 max-w-xl" style={{ background: "#fff", border: `1px solid ${T.sand}` }}>
      <Field label="Homepage headline"><input value={form.heroTitle || ""} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} style={inputStyle} /></Field>
      <Field label="Homepage subtext"><input value={form.heroSubtitle || ""} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} style={inputStyle} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.saleActive} onChange={(e) => setForm({ ...form, saleActive: e.target.checked })} /> Show sale banner</label>
      <Field label="Sale banner text"><input value={form.saleText || ""} onChange={(e) => setForm({ ...form, saleText: e.target.value })} style={inputStyle} /></Field>
      <button type="submit" className="px-6 py-2.5 rounded-lg text-sm font-medium w-fit" style={{ background: T.walnutDark, color: T.cream }}>Save storefront settings</button>
    </form>
  );
}

function CustomerList({ customers }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${T.sand}` }}>
      {customers.length === 0 ? (
        <p className="p-6 text-sm text-center" style={{ color: T.charcoalSoft }}>No customers have signed up yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: T.creamDeep }}>
              <th className="text-left px-3 py-2 font-medium" style={{ color: T.charcoalSoft }}>Username</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: T.charcoalSoft }}>Email</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: T.charcoalSoft }}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((u) => (
              <tr key={u._id} style={{ borderTop: `1px solid ${T.sand}` }}>
                <td className="px-3 py-2">{u.username}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 text-xs" style={{ color: T.charcoalSoft }}>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function OrdersList({ orders }) {
  return (
    <div className="flex flex-col gap-3">
      {orders.length === 0 ? (
        <p className="p-6 text-sm text-center rounded-xl" style={{ background: "#fff", border: `1px solid ${T.sand}`, color: T.charcoalSoft }}>No orders placed yet.</p>
      ) : (
        orders.map((o) => (
          <div key={o._id} className="p-4 rounded-xl" style={{ background: "#fff", border: `1px solid ${T.sand}` }}>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">{o.username}</span>
              <span style={{ color: T.charcoalSoft }}>{new Date(o.createdAt).toLocaleString()}</span>
            </div>
            <ul className="text-xs mb-2" style={{ color: T.charcoalSoft }}>
              {o.items.map((i, idx) => <li key={idx}>{i.qty} × {i.name}</li>)}
            </ul>
            <p className="text-sm font-semibold" style={{ color: T.walnut }}>Total: {INR(o.total)}</p>
          </div>
        ))
      )}
    </div>
  );
}
