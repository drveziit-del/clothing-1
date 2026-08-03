/**
 * Printify API Client — Server-side only.
 */
import 'server-only';
import type { PrintifyProduct, PrintifyOrder } from '@/types';

const BASE_URL = 'https://api.printify.com/v1';

function getToken(): string {
  const token = process.env.PRINTIFY_ACCESS_TOKEN;
  if (!token) throw new Error('PRINTIFY_ACCESS_TOKEN env var not set');
  return token;
}

async function printifyFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Printify API ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getShops(): Promise<Array<{ id: string; title: string }>> {
  return printifyFetch('/shops.json');
}

export async function getProducts(shopId: string): Promise<{ data: PrintifyProduct[] }> {
  return printifyFetch(`/shops/${shopId}/products.json`);
}

export async function getProduct(shopId: string, productId: string): Promise<PrintifyProduct> {
  return printifyFetch(`/shops/${shopId}/products/${productId}.json`);
}

export async function createOrder(shopId: string, orderData: PrintifyOrder): Promise<{ id: string }> {
  return printifyFetch(`/shops/${shopId}/orders.json`, {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
}

export async function getBlueprints(): Promise<Array<{ id: number; title: string }>> {
  return printifyFetch('/catalog/blueprints.json');
}

export async function uploadImage(
  fileName: string,
  base64Content: string
): Promise<{ id: string; url: string }> {
  return printifyFetch('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({
      file_name: fileName,
      contents: base64Content,
    }),
  });
}

export async function getOrderStatus(
  shopId: string,
  printifyOrderId: string
): Promise<{ status: string; shipments: unknown[] }> {
  return printifyFetch(`/shops/${shopId}/orders/${printifyOrderId}.json`);
}
