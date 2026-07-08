import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "/api";

const client = axios.create({ baseURL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("sk_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function unwrap(promise) {
  return promise
    .then((res) => res.data)
    .catch((err) => {
      const message = err.response?.data?.message || "Something went wrong. Please try again.";
      throw new Error(message);
    });
}

export const api = {
  // auth
  signup: (username, email, password) => unwrap(client.post("/auth/signup", { username, email, password })),
  login: (username, password) => unwrap(client.post("/auth/login", { username, password })),

  // products
  getProducts: () => unwrap(client.get("/products")),
  addProduct: (data) => unwrap(client.post("/products", data)),
  updateProduct: (id, data) => unwrap(client.put(`/products/${id}`, data)),
  deleteProduct: (id) => unwrap(client.delete(`/products/${id}`)),

  // cart
  getCart: () => unwrap(client.get("/cart")),
  addToCart: (productId, qty = 1) => unwrap(client.post("/cart", { productId, qty })),
  setCartQty: (productId, qty) => unwrap(client.put(`/cart/${productId}`, { qty })),
  removeFromCart: (productId) => unwrap(client.delete(`/cart/${productId}`)),

  // orders
  checkout: () => unwrap(client.post("/orders/checkout")),
  getMyOrders: () => unwrap(client.get("/orders/mine")),
  getAllOrders: () => unwrap(client.get("/orders")),

  // site config
  getConfig: () => unwrap(client.get("/config")),
  saveConfig: (data) => unwrap(client.put("/config", data)),

  // users (admin)
  getCustomers: () => unwrap(client.get("/users")),
};
