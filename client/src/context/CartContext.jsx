import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Cart (persisted in localStorage). Can hold dishes from several restaurants:
 * at checkout each restaurant becomes its own order (own kitchen, delivery fee, courier and status).
 * Prices here are for display only; the server recalculates everything at checkout.
 */
const CartContext = createContext(null);
const KEY = 'cart.v2';
const OLD_KEY = 'cart.v1';
const EMPTY = { groups: [] };
export const MAX_RESTAURANTS = 5;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.groups) return saved;
    // One-restaurant cart from the previous version -> one group.
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    localStorage.removeItem(OLD_KEY);
    if (old?.restaurant && old.items?.length) return { groups: [{ restaurant: old.restaurant, items: old.items }] };
  } catch { /* ignore */ }
  return EMPTY;
}

/** Snapshot of the restaurant fields the cart needs. */
const pickRestaurant = (r) => ({
  id: r.id, name: r.name, translations: r.translations, sourceLanguage: r.sourceLanguage, imageUrl: r.imageUrl, cuisineType: r.cuisineType, address: r.address,
  deliveryFee: r.deliveryFee, minOrderAmount: r.minOrderAmount, supportsDelivery: r.supportsDelivery,
  supportsPickup: r.supportsPickup, prepTimeMinutes: r.prepTimeMinutes,
});

const pickItem = (item, quantity) => ({
  id: item.id, name: item.name, translations: item.translations, sourceLanguage: item.sourceLanguage,
  price: item.price, imageUrl: item.imageUrl, allergens: item.allergens, dietaryTags: item.dietaryTags, spiceLevel: item.spiceLevel, quantity,
});

const groupTotal = (g) => g.items.reduce((s, i) => s + i.price * i.quantity, 0);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* ignore */ }
  }, [cart]);

  /** True when this restaurant would be one too many for a single checkout. */
  const isFull = useCallback((restaurantId) => (
    cart.groups.length >= MAX_RESTAURANTS && !cart.groups.some((g) => g.restaurant.id === restaurantId)
  ), [cart]);

  const add = useCallback((restaurant, item, quantity = 1) => {
    setCart((c) => {
      const exists = c.groups.some((g) => g.restaurant.id === restaurant.id);
      if (!exists && c.groups.length >= MAX_RESTAURANTS) return c;
      const groups = exists ? c.groups : [...c.groups, { restaurant: pickRestaurant(restaurant), items: [] }];
      return {
        groups: groups.map((g) => {
          if (g.restaurant.id !== restaurant.id) return g;
          const has = g.items.some((i) => i.id === item.id);
          const items = has
            ? g.items.map((i) => (i.id === item.id ? { ...i, quantity: Math.min(99, i.quantity + quantity) } : i))
            : [...g.items, pickItem(item, quantity)];
          return { restaurant: pickRestaurant(restaurant), items }; // refresh fee / minimum with the latest data
        }),
      };
    });
  }, []);

  const setQuantity = useCallback((id, quantity) => {
    setCart((c) => ({
      groups: c.groups
        .map((g) => ({
          ...g,
          items: quantity <= 0
            ? g.items.filter((i) => i.id !== id)
            : g.items.map((i) => (i.id === id ? { ...i, quantity: Math.min(99, quantity) } : i)),
        }))
        .filter((g) => g.items.length),
    }));
  }, []);

  const removeRestaurant = useCallback((restaurantId) => {
    setCart((c) => ({ groups: c.groups.filter((g) => g.restaurant.id !== restaurantId) }));
  }, []);

  const clear = useCallback(() => setCart(EMPTY), []);

  const value = useMemo(() => {
    const groups = cart.groups.map((g) => ({ ...g, itemsTotal: groupTotal(g) }));
    const items = groups.flatMap((g) => g.items);
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const itemsTotal = groups.reduce((s, g) => s + g.itemsTotal, 0);
    return { groups, items, count, itemsTotal, add, setQuantity, removeRestaurant, clear, isFull };
  }, [cart, add, setQuantity, removeRestaurant, clear, isFull]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
