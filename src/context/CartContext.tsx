'use client';

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import type { CartItem, Product, Variant } from '@/types';

interface CartState {
  items: CartItem[];
  referralCode: string;
}

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; variant: Variant; quantity: number }
  | { type: 'REMOVE_ITEM'; productId: string; variantId: string }
  | { type: 'UPDATE_QTY'; productId: string; variantId: string; quantity: number }
  | { type: 'SET_REFERRAL'; code: string }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; state: CartState };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'ADD_ITEM': {
      const key = `${action.product.id}-${action.variant.id}`;
      const existing = state.items.findIndex(
        (i) => `${i.product.id}-${i.variant.id}` === key
      );
      if (existing >= 0) {
        const items = [...state.items];
        items[existing] = {
          ...items[existing],
          quantity: Math.min(items[existing].quantity + action.quantity, 10),
        };
        return { ...state, items };
      }
      return {
        ...state,
        items: [
          ...state.items,
          { product: action.product, variant: action.variant, quantity: action.quantity },
        ],
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(
          (i) => !(i.product.id === action.productId && i.variant.id === action.variantId)
        ),
      };

    case 'UPDATE_QTY': {
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(
            (i) => !(i.product.id === action.productId && i.variant.id === action.variantId)
          ),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.product.id === action.productId && i.variant.id === action.variantId
            ? { ...i, quantity: Math.min(action.quantity, 10) }
            : i
        ),
      };
    }

    case 'SET_REFERRAL': {
      const formatted = action.code.toUpperCase();
      if (state.referralCode === formatted) return state;
      return { ...state, referralCode: formatted };
    }

    case 'CLEAR':
      return { items: [], referralCode: '' };

    default:
      return state;
  }
}

const CART_KEY = 'gerkink_cart';

function loadCartFromStorage(): CartState {
  if (typeof window === 'undefined') return { items: [], referralCode: '' };
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [], referralCode: '' };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      referralCode: typeof parsed?.referralCode === 'string' ? parsed.referralCode : '',
    };
  } catch {
    return { items: [], referralCode: '' };
  }
}

interface CartContextValue {
  items: CartItem[];
  referralCode: string;
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, variant: Variant, quantity?: number) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQty: (productId: string, variantId: string, quantity: number) => void;
  setReferralCode: (code: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue>({
  items: [],
  referralCode: '',
  itemCount: 0,
  subtotal: 0,
  addItem: () => {},
  removeItem: () => {},
  updateQty: () => {},
  setReferralCode: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], referralCode: '' });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadCartFromStorage();
    if (saved.items.length > 0 || saved.referralCode) {
      dispatch({ type: 'HYDRATE', state: saved });
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_KEY, JSON.stringify(state));
    }
  }, [state]);

  const itemCount = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items]
  );
  const subtotal = useMemo(
    () => state.items.reduce((sum, i) => sum + i.variant.price * i.quantity, 0),
    [state.items]
  );

  const addItem = useCallback(
    (product: Product, variant: Variant, quantity = 1) =>
      dispatch({ type: 'ADD_ITEM', product, variant, quantity }),
    []
  );

  const removeItem = useCallback(
    (productId: string, variantId: string) =>
      dispatch({ type: 'REMOVE_ITEM', productId, variantId }),
    []
  );

  const updateQty = useCallback(
    (productId: string, variantId: string, quantity: number) =>
      dispatch({ type: 'UPDATE_QTY', productId, variantId, quantity }),
    []
  );

  const setReferralCode = useCallback(
    (code: string) => dispatch({ type: 'SET_REFERRAL', code }),
    []
  );

  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const value = useMemo(
    () => ({
      items: state.items,
      referralCode: state.referralCode,
      itemCount,
      subtotal,
      addItem,
      removeItem,
      updateQty,
      setReferralCode,
      clearCart,
    }),
    [state.items, state.referralCode, itemCount, subtotal, addItem, removeItem, updateQty, setReferralCode, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
