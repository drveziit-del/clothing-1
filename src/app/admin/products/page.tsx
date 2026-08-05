'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/ui/Modal';
import styles from '../page.module.css';
import { useRoast } from '@/hooks/useRoast';
import { useCurrency } from '@/context/CurrencyContext';

interface Product {
  id: string;
  printifyId: string;
  title: string;
  description: string;
  section: 'society_fuckers' | 'valueless_bitches';
  price: number;
  tier?: number;
  isPublished: boolean;
  images: string[];
  videos?: string[];
}

export default function AdminProductsPage() {
  const { toast } = useRoast();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data);
    } catch {
      toast('Failed to load products.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const handleFocus = () => {
      fetchProducts();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Sync products
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/products/sync', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.errors && data.errors.length > 0) {
        toast(`Synced ${data.synced} products with errors.`, 'error');
      } else {
        toast(`Successfully synced ${data.synced} products!`, 'success');
      }
      fetchProducts();
    } catch {
      toast('Failed to sync products from Printify.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Open Add modal in new tab
  const openAddModal = () => {
    window.open('/admin/products/new', '_blank');
  };

  // Open Edit modal in new tab
  const openEditModal = (product: Product) => {
    window.open(`/admin/products/edit?id=${product.id}`, '_blank');
  };

  // Delete product
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('Product deleted successfully.', 'success');
      fetchProducts();
    } catch {
      toast('Failed to delete product.', 'error');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className={styles.title}>Products</h1>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn btn-secondary btn-sm"
            >
              {syncing ? 'Syncing...' : 'Sync from Printify'}
            </button>
            <button
              onClick={openAddModal}
              className="btn btn-primary btn-sm"
            >
              + Add Product
            </button>
          </div>
        </div>
        <p className={styles.subtitle}>Manage both collections. Sync pulls latest from Printify.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading products...
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'title', label: 'Product' },
            {
              key: 'section',
              label: 'Collection',
              render: (r) => (
                <span className={`tag ${r.section === 'society_fuckers' ? 'tag-mist' : 'tag-coral'}`}>
                  {r.section === 'society_fuckers' ? 'Society Fu*kers' : 'Valueless Bi*ches'}
                </span>
              ),
            },
            {
              key: 'tier',
              label: 'Tier',
              render: (r) => (r.tier ? `Tier ${r.tier}` : '—'),
            },
            {
              key: 'price',
              label: 'Price',
              align: 'right',
              render: (r) => formatPrice(r.price),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <span className={`tag ${r.isPublished ? 'tag-coral' : ''}`}>
                  {r.isPublished ? 'Published' : 'Draft'}
                </span>
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              align: 'right',
              render: (r) => (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => openEditModal(r)}
                    className="btn btn-secondary btn-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="btn btn-secondary btn-xs"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          data={products}
          emptyMessage="No products. Connect Printify and sync to get started."
        />
      )}
    </div>
  );
}
