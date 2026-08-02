'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useRoast } from '@/hooks/useRoast';
import { getFirestoreDb, getFirebaseStorage, getFirestoreModule, getStorageModule } from '@/lib/firebase/config';
import styles from '../../page.module.css';
import productStyles from '../../../shop/[productId]/ProductDetailClient.module.css';

interface UgcVideo {
  name: string;
  stars: number;
  videoUrl: string;
}

function UgcVideoCardPreview({ video, isActive }: { video: UgcVideo; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isActive) {
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    } else {
      videoEl.pause();
      videoEl.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isPlaying) {
      videoEl.pause();
      setIsPlaying(false);
    } else {
      videoEl.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  return (
    <div
      className={`${productStyles.ugcVideoCard} ${isActive ? productStyles.ugcVideoCardActive : ''}`}
      onClick={togglePlay}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      <video
        ref={videoRef}
        src={video.videoUrl}
        loop
        muted
        playsInline
        className={productStyles.ugcVideoElement}
      />
      {!isPlaying && (
        <div className={productStyles.ugcPlayOverlay}>
          <span style={{ fontSize: '2rem', color: 'white' }}>▶</span>
        </div>
      )}
      <div className={productStyles.ugcVideoInfo}>
        <div style={{ display: 'flex', color: '#FFD700', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
          {'★'.repeat(video.stars)}{'☆'.repeat(5 - video.stars)}
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{video.name}</div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Verified Owner</div>
      </div>
    </div>
  );
}

function EditProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { toast } = useRoast();

  // Product states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [section, setSection] = useState<'society_fuckers' | 'valueless_bitches'>('valueless_bitches');
  const [price, setPrice] = useState('');
  const [tier, setTier] = useState('');
  const [prebookingPrice, setPrebookingPrice] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  // Editor mode toggle
  const [editorMode, setEditorMode] = useState<'form' | 'visual'>('visual');

  // Product Page Section Toggles
  const [showManifesto, setShowManifesto] = useState(true);
  const [showSpecs, setShowSpecs] = useState(true);
  const [showFeatures, setShowFeatures] = useState(true);
  const [showComparison, setShowComparison] = useState(true);
  const [showUgc, setShowUgc] = useState(true);
  const [showFaq, setShowFaq] = useState(true);

  // Custom Content Text fields
  const [fitRecommendation, setFitRecommendation] = useState('');
  const [materialSpec, setMaterialSpec] = useState('');
  const [fitSpec, setFitSpec] = useState('');
  const [weightSpec, setWeightSpec] = useState('');
  const [originSpec, setOriginSpec] = useState('');
  const [manifestoQuote, setManifestoQuote] = useState('');
  const [manifestoBody, setManifestoBody] = useState('');
  const [commitmentText, setCommitmentText] = useState('');

  // UGC Videos Array
  const [ugcVideosList, setUgcVideosList] = useState<Array<{ name: string; stars: number; videoUrl: string }>>([]);

  // Customizable features, comparison, and FAQ arrays
  const [featuresList, setFeaturesList] = useState<Array<{ title: string; description: string }>>([]);
  const [comparisonRows, setComparisonRows] = useState<Array<{ feature: string; us: string; them: string }>>([]);
  const [faqsList, setFaqsList] = useState<Array<{ q: string; a: string }>>([]);

  // Visual Editor preview states
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [descOpen, setDescOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({});
  const [activeUgcIndex, setActiveUgcIndex] = useState(0);
  const ugcSliderRef = useRef<HTMLDivElement>(null);

  const handleUgcPrev = () => {
    const nextIndex = (activeUgcIndex - 1 + displayUgcVideos.length) % displayUgcVideos.length;
    setActiveUgcIndex(nextIndex);
    const container = ugcSliderRef.current;
    if (container && container.children[nextIndex]) {
      (container.children[nextIndex] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  };

  const handleUgcNext = () => {
    const nextIndex = (activeUgcIndex + 1) % displayUgcVideos.length;
    setActiveUgcIndex(nextIndex);
    const container = ugcSliderRef.current;
    if (container && container.children[nextIndex]) {
      (container.children[nextIndex] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  };

  // Media states
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [filename: string]: number }>({});
  const [uploading, setUploading] = useState(false);

  // Variants Manager State
  const [hasVariants, setHasVariants] = useState(false);
  const [variantsColors, setVariantsColors] = useState<Array<{ name: string; hex: string }>>([]);
  const [variantsSizes, setVariantsSizes] = useState<string[]>([]);
  const [variantsList, setVariantsList] = useState<Array<{
    id: string;
    size: string;
    color: string;
    colorHex?: string;
    price: number;
    available: boolean;
    images?: string[];
  }>>([]);

  // Temp states for color adding
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#ffffff');

  // Array editing handlers
  const handleUpdateFaq = (index: number, field: 'q' | 'a', value: string) => {
    setFaqsList(prev => prev.map((faq, i) => i === index ? { ...faq, [field]: value } : faq));
  };
  const handleAddFaq = () => {
    setFaqsList(prev => [...prev, { q: 'NEW QUESTION?', a: 'Write the answer here.' }]);
  };
  const handleDeleteFaq = (index: number) => {
    setFaqsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateFeature = (index: number, field: 'title' | 'description', value: string) => {
    setFeaturesList(prev => prev.map((feat, i) => i === index ? { ...feat, [field]: value } : feat));
  };

  const handleUpdateComparisonRow = (index: number, field: 'feature' | 'us' | 'them', value: string) => {
    setComparisonRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };
  const handleAddComparisonRow = () => {
    setComparisonRows(prev => [...prev, { feature: 'NEW FEATURE', us: 'Our spec value', them: 'Generic brand spec value' }]);
  };
  const handleDeleteComparisonRow = (index: number) => {
    setComparisonRows(prev => prev.filter((_, i) => i !== index));
  };

  // Sync variants structure when colors or sizes change
  useEffect(() => {
    if (!hasVariants) {
      setVariantsList([]);
      return;
    }
    if (variantsColors.length === 0 || variantsSizes.length === 0) {
      setVariantsList([]);
      return;
    }

    const nextList: typeof variantsList = [];
    variantsColors.forEach((color) => {
      variantsSizes.forEach((size) => {
        const key = `${color.name}-${size}`;
        const existing = variantsList.find((v) => v.color === color.name && v.size === size);
        nextList.push({
          id: existing?.id || key,
          color: color.name,
          colorHex: color.hex,
          size,
          price: existing?.price || (price ? Number(price) : 0),
          available: existing ? existing.available : true,
          images: existing?.images || [],
        });
      });
    });
    setVariantsList(nextList);
  }, [hasVariants, variantsColors, variantsSizes, price]);

  // Set default selected variant once product/variants load
  useEffect(() => {
    if (variantsList && variantsList.length > 0) {
      const activeColor = selectedVariant?.color;
      const remains = variantsList.find(v => v.color === activeColor);
      if (!remains) {
        setSelectedVariant(variantsList[0]);
      }
    } else {
      setSelectedVariant(null);
    }
  }, [variantsList]);

  // Fetch product on mount or id change
  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/admin/products?id=${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        setTitle(data.title || '');
        setDescription(data.description || '');
        setSection(data.section || 'valueless_bitches');
        setPrice(data.price ? data.price.toString() : '');
        setTier(data.tier ? data.tier.toString() : '');
        setPrebookingPrice(data.prebookingPrice ? data.prebookingPrice.toString() : '');
        setIsPublished(!!data.isPublished);
        setImages(data.images || []);
        setVideos(data.videos || []);

        setShowManifesto(data.showManifesto !== false);
        setShowSpecs(data.showSpecs !== false);
        setShowFeatures(data.showFeatures !== false);
        setShowComparison(data.showComparison !== false);
        setShowUgc(data.showUgc !== false);
        setShowFaq(data.showFaq !== false);

        setFitRecommendation(data.fitRecommendation || '');
        setMaterialSpec(data.materialSpec || '');
        setFitSpec(data.fitSpec || '');
        setWeightSpec(data.weightSpec || '');
        setOriginSpec(data.originSpec || '');
        setManifestoQuote(data.manifestoQuote || '');
        setManifestoBody(data.manifestoBody || '');
        setCommitmentText(data.commitmentText || '');
        setUgcVideosList(data.ugcVideos || []);

        setFeaturesList(data.featuresList || [
          { title: "Premium Fabric", description: "Spun from high-density yarns to provide maximum structural stiffness and lookbook aesthetics." },
          { title: "Fade Resistant", description: "Advanced ink injection guarantees prints won't peel, crack, or fade over time." },
          { title: "Double Stitched", description: "Double-needle stitching at stress points ensures durability that survives the test of daily wear." },
          { title: "Heavyweight GSM", description: "Thicker fabric weight hangs naturally off the shoulders for a modern premium drape." },
          { title: "Oversized Fit", description: "Engineered streetwear silhouette optimized to flow naturally without clamping your movement." },
          { title: "Breathable Knit", description: "Cotton loops permit dynamic ventilation so you remain comfortable regardless of weather." }
        ]);
        setComparisonRows(data.comparisonRows || [
          { feature: "Fabric weight", us: "240GSM (Ultra Heavyweight)", them: "140GSM (Thin & flimsy)" },
          { feature: "Print durability", us: "Zero-crack ink injection", them: "Plastic prints that peel and split" },
          { feature: "Fabric source", us: "WRAP-Certified Ethical Knitwear", them: "Mass-produced low-cost sweatshops" },
          { feature: "Collar build", us: "Double-needle ribbed shape lock", them: "Single-stitch that sags after one wash" }
        ]);
        setFaqsList(data.faqsList || [
          { q: "WHEN WILL MY ORDER SHIP?", a: "We process and ship all orders within 24-48 business hours. You will receive an automated tracking code as soon as the shipping carrier scans the parcel." },
          { q: "HOW SHOULD I WASH GERKINK GARMENTS?", a: "To preserve print durability and fabric weight, wash inside out with cold water on a delicate cycle. Hang dry or tumble dry low. Do not iron directly on the graphics." },
          { q: "WHAT IS YOUR RETURN POLICY?", a: "We accept returns for store credit or refunds on all unworn, unwashed items within 14 days of delivery. Pre-booked deposits on custom orders remain non-refundable." },
          { q: "ARE SIZES TRUE TO STREETWEAR MEASUREMENTS?", a: "All garments fit slightly oversized/relaxed off the shoulder. If you prefer a standard fitted silhouette, order one size down." }
        ]);

        if (data.variants && data.variants.length > 0) {
          const isDefaultOnly = data.variants.length === 1 &&
            data.variants[0].color === 'Default' &&
            data.variants[0].size === 'One Size';

          if (!isDefaultOnly) {
            setHasVariants(true);
            setVariantsList(data.variants);

            const colorsMap: Record<string, string> = {};
            data.variants.forEach((v: any) => {
              if (v.color && v.color !== 'Default') {
                colorsMap[v.color] = v.colorHex || '#ffffff';
              }
            });
            const uniqueColors = Object.entries(colorsMap).map(([name, hex]) => ({ name, hex }));
            setVariantsColors(uniqueColors);

            const uniqueSizes = [...new Set(data.variants.map((v: any) => v.size))].filter(
              (s) => s !== 'One Size'
            ) as string[];
            setVariantsSizes(uniqueSizes);
          } else {
            setHasVariants(false);
          }
        }
      } catch {
        toast('Failed to load product details.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // File Upload Helper
  const handleFileUpload = async (file: File, type: 'image' | 'video') => {
    if (!id) return;
    if (type === 'image' && images.length >= 7) {
      toast('Maximum 7 images allowed.', 'error');
      return;
    }
    if (type === 'video' && videos.length >= 2) {
      toast('Maximum 2 videos allowed.', 'error');
      return;
    }

    const { ref, uploadBytesResumable, getDownloadURL } = getStorageModule();
    const filename = `${Date.now()}_${file.name}`;
    const storageRef = ref(getFirebaseStorage(), `products/${id}/${filename}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setUploading(true);
    setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

    return new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress((prev) => ({ ...prev, [file.name]: Math.round(progress) }));
        },
        (error) => {
          console.error('Upload failed:', error);
          toast(`Upload failed for ${file.name}`, 'error');
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
          setUploading(false);
          reject(error);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (type === 'image') {
              setImages((prev) => [...prev, downloadUrl]);
            } else {
              setVideos((prev) => [...prev, downloadUrl]);
            }
            setUploadProgress((prev) => {
              const next = { ...prev };
              delete next[file.name];
              return next;
            });
            setUploading(false);
            resolve(downloadUrl);
          } catch (err) {
            setUploading(false);
            reject(err);
          }
        }
      );
    });
  };

  // Remove Media Helper
  const handleRemoveMedia = async (url: string, type: 'image' | 'video') => {
    try {
      if (url.includes('firebasestorage.googleapis.com')) {
        const { ref, deleteObject } = getStorageModule();
        const storageRef = ref(getFirebaseStorage(), url);
        await deleteObject(storageRef).catch((err) => {
          console.warn('Could not delete object from Storage (might not exist):', err);
        });
      }
    } catch (err) {
      console.error('Error removing file from storage:', err);
    }

    if (type === 'image') {
      setImages((prev) => prev.filter((u) => u !== url));
    } else {
      setVideos((prev) => prev.filter((u) => u !== url));
    }
  };

  // Submit Edit Product
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !title || !price) {
      toast('Please fill in required fields.', 'error');
      return;
    }

    if (uploading || Object.keys(uploadProgress).length > 0) {
      toast('Please wait for uploads to finish.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title,
          description,
          section,
          price: Number(price),
          tier: tier ? Number(tier) : null,
          prebookingPrice: prebookingPrice ? Number(prebookingPrice) : null,
          isPublished,
          images,
          videos,
          variants: hasVariants ? variantsList : null,
          showManifesto,
          showSpecs,
          showFeatures,
          showComparison,
          showUgc,
          showFaq,
          fitRecommendation,
          materialSpec,
          fitSpec,
          weightSpec,
          originSpec,
          manifestoQuote,
          manifestoBody,
          ugcVideos: ugcVideosList,
          featuresList,
          comparisonRows,
          faqsList,
          commitmentText,
        }),
      });

      if (!res.ok) throw new Error();

      toast('Product updated successfully.', 'success');
      if (window.opener) {
        window.close();
      } else {
        router.push('/admin/products');
      }
    } catch {
      toast('Failed to update product.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (window.opener) {
      window.close();
    } else {
      router.push('/admin/products');
    }
  };

  const colors = useMemo(() => {
    return [...new Set(variantsList.map((v) => v.color))];
  }, [variantsList]);

  const sizes = useMemo(() => {
    return [...new Set(
      variantsList
        .filter((v) => v.color === selectedVariant?.color)
        .map((v) => v.size)
    )];
  }, [variantsList, selectedVariant?.color]);

  const displayedImages = useMemo(() => {
    if (!selectedVariant?.color) return images;
    const activeColorVariants = variantsList.filter((v) => v.color === selectedVariant.color);
    const colorImageUrls = activeColorVariants.flatMap((v) => v.images || []).filter(Boolean);
    const uniqueColorUrls = [...new Set(colorImageUrls)];
    return uniqueColorUrls.length > 0 ? uniqueColorUrls : images;
  }, [images, variantsList, selectedVariant?.color]);

  const media = useMemo(() => {
    return [
      ...displayedImages.map((url) => ({ type: 'image' as const, url })),
      ...videos.map((url) => ({ type: 'video' as const, url })),
    ];
  }, [displayedImages, videos]);

  const defaultUgcVideos = useMemo(() => [
    { name: "Doria Von", stars: 5, videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
    { name: "Terrance O'Hara", stars: 5, videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" },
    { name: "Kiana Jacobi", stars: 5, videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" },
    { name: "Kiana Jacobi", stars: 5, videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" }
  ], []);

  const displayUgcVideos = useMemo(() => {
    return ugcVideosList.length > 0 ? ugcVideosList : defaultUgcVideos;
  }, [ugcVideosList, defaultUgcVideos]);

  if (!id) {
    return (
      <div className={styles.page} style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--accent)' }}>Invalid or missing product ID.</p>
        <button onClick={handleCancel} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Go Back
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page} style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        Loading product details...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#ffffff' }}>
      {/* Top Header sticky controls bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#121212', borderBottom: '1px solid #222', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            GERKINK VISUAL CMS
          </span>
          <div style={{ display: 'flex', gap: '0.25rem', background: '#1c1c1c', padding: '2px', borderRadius: '4px', border: '1px solid #333' }}>
            <button
              type="button"
              onClick={() => setEditorMode('visual')}
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', border: 'none', background: editorMode === 'visual' ? 'var(--accent)' : 'transparent', color: editorMode === 'visual' ? 'white' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', fontWeight: 'bold' }}
            >
              Visual Mode (Live Editor)
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('form')}
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', border: 'none', background: editorMode === 'form' ? 'var(--accent)' : 'transparent', color: editorMode === 'form' ? 'white' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', fontWeight: 'bold' }}
            >
              Form Mode (Metadata/Variants)
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" onClick={handleCancel} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 1rem' }}>
            Cancel
          </button>
          <button type="button" onClick={() => handleSubmit()} disabled={submitting || uploading} className="btn btn-primary btn-sm" style={{ padding: '0.4rem 1rem' }}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {editorMode === 'form' ? (
        <div className={styles.page} style={{ maxWidth: '700px', margin: '2rem auto' }}>
          <div className={styles.header}>
            <h1 className={styles.title}>Edit Product</h1>
            <p className={styles.subtitle}>Update collection details or custom media parameters</p>
          </div>

          <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--surface-1)', padding: '2rem', border: '1px solid var(--border)', borderRadius: '4px' }}>
            <div>
              <label className="input-label">Product Title (Required)</label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brutal design title"
                required
              />
            </div>

            <div>
              <label className="input-label">Description</label>
              <textarea
                className="input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product narrative / roast details"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <div>
                <label className="input-label">Collection</label>
                <select
                  className="input"
                  value={section}
                  onChange={(e) => {
                    const val = e.target.value as 'society_fuckers' | 'valueless_bitches';
                    setSection(val);
                    if (val === 'valueless_bitches') setTier('');
                  }}
                  style={{ background: 'var(--surface-2)' }}
                >
                  <option value="valueless_bitches">Valueless Bi*ches (Streetwear)</option>
                  <option value="society_fuckers">Society Fu*kers (Luxury)</option>
                </select>
              </div>

              <div>
                <label className="input-label">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {section === 'society_fuckers' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="input-label">Luxury Tier (1 - 5)</label>
                  <select
                    className="input"
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <option value="">No Tier</option>
                    <option value="1">Tier 1 — GOD TIER</option>
                    <option value="2">Tier 2 — OBSCENE</option>
                    <option value="3">Tier 3 — DELUSIONAL</option>
                    <option value="4">Tier 4 — WANNABE</option>
                    <option value="5">Tier 5 — PEASANT PREMIUM</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Prebooking Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.00"
                    className="input"
                    value={prebookingPrice}
                    onChange={(e) => setPrebookingPrice(e.target.value)}
                    placeholder="500.00"
                  />
                </div>
              </div>
            )}

            {/* Media Uploads Form Controls */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <label className="input-label">Product Images (Up to 7)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                {images.map((url) => (
                  <div key={url} style={{ position: 'relative', aspectRatio: '1', border: '1px solid var(--border)', background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <Image src={url} alt="Product Image" fill sizes="80px" style={{ objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(url, 'image')}
                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {images.length < 7 && (
                  <label style={{ aspectRatio: '1', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--surface-2)', fontSize: '0.75rem', color: 'var(--text-muted)', gap: '0.25rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>+</span>
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          const remaining = 7 - images.length;
                          const filesToUpload = files.slice(0, remaining);
                          for (const file of filesToUpload) {
                            await handleFileUpload(file, 'image');
                          }
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="input-label">Product Videos (Up to 2)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                {videos.map((url) => (
                  <div key={url} style={{ position: 'relative', aspectRatio: '1', border: '1px solid var(--border)', background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <video src={url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(url, 'video')}
                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {videos.length < 2 && (
                  <label style={{ aspectRatio: '1', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--surface-2)', fontSize: '0.75rem', color: 'var(--text-muted)', gap: '0.25rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>+</span>
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      onChange={async (e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          const remaining = 2 - videos.length;
                          const filesToUpload = files.slice(0, remaining);
                          for (const file of filesToUpload) {
                            await handleFileUpload(file, 'video');
                          }
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {Object.keys(uploadProgress).length > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.25rem' }}>
                {Object.entries(uploadProgress).map(([name, pct]) => (
                  <div key={name}>Uploading {name}: {pct}%</div>
                ))}
              </div>
            )}

            {/* Variants Manager Section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="hasVariants"
                  checked={hasVariants}
                  onChange={(e) => setHasVariants(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="hasVariants" style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  This product has multiple color or size options
                </label>
              </div>

              {hasVariants && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--surface-2)', padding: '1.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  
                  {/* Color Configuration */}
                  <div>
                    <label className="input-label" style={{ marginBottom: '0.5rem' }}>Configure Colors</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <input
                        type="text"
                        className="input"
                        value={newColorName}
                        onChange={(e) => setNewColorName(e.target.value)}
                        placeholder="e.g. White, Black, Navy"
                        style={{ background: 'var(--surface-1)' }}
                      />
                      <input
                        type="color"
                        value={newColorHex}
                        onChange={(e) => setNewColorHex(e.target.value)}
                        style={{ border: 'none', width: '40px', height: '40px', padding: '0', background: 'transparent', cursor: 'pointer' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newColorName.trim()) {
                            if (variantsColors.some(c => c.name.toLowerCase() === newColorName.trim().toLowerCase())) {
                              toast('Color name already exists.', 'error');
                              return;
                            }
                            setVariantsColors(prev => [...prev, { name: newColorName.trim(), hex: newColorHex }]);
                            setNewColorName('');
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Add
                      </button>
                    </div>

                    {variantsColors.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {variantsColors.map((color) => (
                          <div key={color.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-1)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: color.hex, border: '1px solid var(--border)' }} />
                            <span style={{ fontSize: '0.75rem' }}>{color.name}</span>
                            <button
                              type="button"
                              onClick={() => setVariantsColors((prev) => prev.filter((c) => c.name !== color.name))}
                              style={{ border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '0.2rem', padding: '0 0.1rem' }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Size Configuration */}
                  <div>
                    <label className="input-label" style={{ marginBottom: '0.5rem' }}>Configure Sizes</label>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {['S', 'M', 'L', 'XL', 'XXL', '3XL', 'One Size'].map((size) => {
                        const isChecked = variantsSizes.includes(size);
                        return (
                          <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setVariantsSizes((prev) => prev.filter((s) => s !== size));
                                } else {
                                  setVariantsSizes((prev) => [...prev, size]);
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <span>{size}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Generated Variants Pricing Table */}
                  {variantsList.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                      <label className="input-label" style={{ marginBottom: '0.5rem' }}>Manage Variants Matrix ({variantsList.length})</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '2px', background: 'var(--surface-1)' }}>
                        {variantsList.map((variant, index) => (
                          <div
                            key={variant.id}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0.75rem', borderBottom: index < variantsList.length - 1 ? '1px solid var(--border)' : 'none', opacity: variant.available ? 1 : 0.5 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: '0' }}>
                              {variant.colorHex && (
                                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: variant.colorHex, border: '1px solid var(--border)', flexShrink: 0 }} />
                              )}
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {variant.color} / {variant.size}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={variant.price}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 0;
                                    setVariantsList((prev) =>
                                      prev.map((v, i) => (i === index ? { ...v, price: val } : v))
                                    );
                                  }}
                                  style={{ width: '70px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-primary)' }}
                                />
                              </div>

                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={variant.available}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setVariantsList((prev) =>
                                      prev.map((v, i) => (i === index ? { ...v, available: val } : v))
                                    );
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span>Active</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                id="isPublished"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="isPublished" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                Publish product (visible in shop)
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={() => handleSubmit()} disabled={submitting || uploading} className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Visual Mode live WYSIWYG Editor */
        <div style={{ padding: '2rem 1rem 6rem 1rem' }}>
          <div className={productStyles.container}>
            <div className={productStyles.layout}>
              
              {/* Product Media Gallery (Left Side) */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Images Gallery (Click ✕ to delete)
                </div>
                <div className={productStyles.galleryGrid}>
                  {media.length === 0 ? (
                    <div className={`${productStyles.galleryItem} ${productStyles.gridItemFull}`}>
                      <div className={productStyles.imgPlaceholder}>NO MEDIA</div>
                    </div>
                  ) : (
                    media.map((item, idx) => {
                      const isFull = idx === 0 || idx === 3;
                      const gridClass = isFull ? productStyles.gridItemFull : productStyles.gridItemHalf;
                      return (
                        <div key={idx} className={`${productStyles.galleryItem} ${gridClass}`} style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.type === 'image') {
                                setImages(prev => prev.filter(url => url !== item.url));
                              } else {
                                setVideos(prev => prev.filter(url => url !== item.url));
                              }
                            }}
                            style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}
                            title="Delete image"
                          >
                            ✕
                          </button>
                          {item.type === 'video' ? (
                            <video src={item.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Image src={item.url} alt="Gallery item" fill sizes="(max-width: 768px) 100vw, 50vw" className={productStyles.galleryMedia} />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Product Info (Right Side) */}
              <div className={productStyles.info}>
                <div className={productStyles.infoTop}>
                  <div className={productStyles.breadcrumb}>
                    <span>Shop</span>
                    <span>/</span>
                    <span style={{ color: 'var(--accent)' }}>{section === 'society_fuckers' ? 'SOCIETY FUCKERS' : 'VALUELESS BITCHES'}</span>
                  </div>

                  {section === 'society_fuckers' && tier && (
                    <div className={productStyles.seasonTag}>
                      {tier === '1' ? 'GOD TIER' : tier === '2' ? 'OBSCENE' : tier === '3' ? 'DELUSIONAL' : tier === '4' ? 'WANNABE' : 'PEASANT PREMIUM'}
                    </div>
                  )}

                  <div className={productStyles.titleRatingRow}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Product Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={productStyles.title}
                      style={{ background: 'transparent', border: '1px dashed #444', outline: 'none', padding: '0.25rem 0.5rem', width: '100%' }}
                    />

                    <div className={productStyles.reviewStarsSummary}>
                      ★★★★★ <span className={productStyles.reviewCount}>(4.8/5 based on 89 reviews)</span>
                    </div>
                  </div>

                  {/* Pricing Editor */}
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Base Price (USD)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '1.25rem', color: 'var(--accent)' }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          style={{ background: 'transparent', border: '1px dashed #444', outline: 'none', color: 'var(--accent)', fontSize: '1.25rem', fontWeight: 'bold', width: '100px', padding: '2px' }}
                        />
                      </div>
                    </div>

                    {section === 'society_fuckers' && (
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Prebook Deposit Price (USD)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.00"
                            value={prebookingPrice}
                            onChange={(e) => setPrebookingPrice(e.target.value)}
                            style={{ background: 'transparent', border: '1px dashed #444', outline: 'none', color: '#fff', fontSize: '1rem', width: '100px', padding: '2px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Color option switcher (preview) */}
                {colors.length > 0 && (
                  <div className={productStyles.variantGroup}>
                    <label className="input-label">Select Color Option</label>
                    <div className={productStyles.colorsGrid}>
                      {colors.map((colorName) => {
                        const variant = variantsList.find((v) => v.color === colorName);
                        const isSelected = selectedVariant?.color === colorName;
                        return (
                          <button
                            key={colorName}
                            type="button"
                            className={`${productStyles.colorCircle} ${isSelected ? productStyles.colorCircleActive : ''}`}
                            style={{ background: variant?.colorHex || '#ffffff' }}
                            onClick={() => variant && setSelectedVariant(variant)}
                            title={colorName}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size options switcher (preview) */}
                {sizes.length > 0 && (
                  <div className={productStyles.variantGroup}>
                    <label className="input-label">Select Size</label>
                    <div className={productStyles.sizesGrid}>
                      {sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`${productStyles.sizeBtn} ${selectedVariant?.size === size ? productStyles.sizeBtnActive : ''}`}
                          onClick={() => {
                            const v = variantsList.find(v => v.color === selectedVariant?.color && v.size === size);
                            if (v) setSelectedVariant(v);
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    
                    {/* Inline Fit recommendation */}
                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Model Fit Recommendation</label>
                      <input
                        type="text"
                        value={fitRecommendation}
                        onChange={(e) => setFitRecommendation(e.target.value)}
                        placeholder="Model is 6'1 tall, wearing size XL"
                        style={{ background: 'transparent', border: '1px dashed #444', color: '#888', outline: 'none', width: '100%', padding: '0.25rem', fontSize: '0.8rem', fontStyle: 'italic' }}
                      />
                    </div>
                  </div>
                )}

                {/* Quick settings switches */}
                <div style={{ borderTop: '1px solid #222', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 'bold' }}>Quick Settings</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      id="visual-publish"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="visual-publish" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Visible in Store (Published)</label>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Collection: </span>
                      <strong style={{ fontSize: '0.8rem' }}>{section === 'society_fuckers' ? 'Society Fuckers' : 'Valueless Bitches'}</strong>
                    </div>
                    {section === 'society_fuckers' && (
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tier: </span>
                        <strong style={{ fontSize: '0.8rem' }}>Tier {tier || 'None'}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className={productStyles.descriptionWrapper}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Product Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={productStyles.descriptionText}
                    rows={6}
                    style={{ background: 'transparent', border: '1px dashed #444', outline: 'none', width: '100%', padding: '0.5rem', color: '#888', resize: 'vertical' }}
                  />
                </div>

                {/* Accordion Drawers */}
                <div className={productStyles.drawers}>
                  <div className={productStyles.drawer}>
                    <button
                      className={productStyles.drawerHeader}
                      onClick={() => setDetailsOpen(!detailsOpen)}
                      type="button"
                    >
                      <span>PRODUCT FEATURES</span>
                      <span className={productStyles.drawerArrow}>{detailsOpen ? '−' : '+'}</span>
                    </button>
                    <div className={`${productStyles.drawerContent} ${detailsOpen ? productStyles.drawerContentOpen : ''}`}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        * Features list is parsed automatically from description on storefront client.
                      </p>
                    </div>
                  </div>

                  <div className={productStyles.drawer}>
                    <button
                      className={productStyles.drawerHeader}
                      onClick={() => setCommitmentOpen(!commitmentOpen)}
                      type="button"
                    >
                      <span>OUR COMMITMENT</span>
                      <span className={productStyles.drawerArrow}>{commitmentOpen ? '−' : '+'}</span>
                    </button>
                    <div className={`${productStyles.drawerContent} ${commitmentOpen ? productStyles.drawerContentOpen : ''}`} style={{ padding: '0.5rem 0' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Commitment Override Text</label>
                      <textarea
                        value={commitmentText}
                        onChange={(e) => setCommitmentText(e.target.value)}
                        rows={3}
                        placeholder="GERKINK stands for zero apologies..."
                        style={{ background: 'transparent', border: '1px dashed #444', outline: 'none', width: '100%', padding: '0.25rem', color: '#888', fontSize: '0.8rem', resize: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Brand Manifesto Section Editor */}
          <div style={{ borderTop: '1px solid #222', marginTop: '3rem', background: '#0a0a0a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '0.5rem 1rem', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Brand Manifesto Section</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showManifesto}
                  onChange={(e) => setShowManifesto(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{showManifesto ? '👁️ Section Enabled' : '👁️‍🗨️ Section Hidden'}</span>
              </label>
            </div>
            <div style={{ opacity: showManifesto ? 1 : 0.3, transition: 'opacity 0.2s ease', pointerEvents: showManifesto ? 'auto' : 'none', padding: '3rem 1.5rem' }}>
              <section className={productStyles.manifestoSection} style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Manifesto Quote</label>
                <input
                  type="text"
                  value={manifestoQuote}
                  onChange={(e) => setManifestoQuote(e.target.value)}
                  placeholder='e.g. "WE DO NOT FIT IN. WE DO NOT APOLOGIZE."'
                  style={{ background: 'transparent', border: '1px dashed #444', color: '#fff', fontSize: '1.5rem', textAlign: 'center', outline: 'none', padding: '0.5rem', width: '100%', marginBottom: '1.5rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 'bold' }}
                />

                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Manifesto Body Paragraph</label>
                <textarea
                  value={manifestoBody}
                  onChange={(e) => setManifestoBody(e.target.value)}
                  placeholder="Tell your brand story..."
                  rows={4}
                  style={{ background: 'transparent', border: '1px dashed #444', color: '#888', fontSize: '0.95rem', textAlign: 'center', outline: 'none', padding: '0.5rem', width: '100%', resize: 'vertical' }}
                />
              </section>
            </div>
          </div>

          {/* "Why You'll Love It" Features Section Editor */}
          <div style={{ borderTop: '1px solid #222', marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '0.5rem 1rem', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Why You'll Love It Grid (6 Cards)</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showFeatures}
                  onChange={(e) => setShowFeatures(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{showFeatures ? '👁️ Section Enabled' : '👁️‍🗨️ Section Hidden'}</span>
              </label>
            </div>
            <div style={{ opacity: showFeatures ? 1 : 0.3, transition: 'opacity 0.2s ease', pointerEvents: showFeatures ? 'auto' : 'none', padding: '3rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
              <section className={productStyles.featuresSection}>
                <h3 className={productStyles.sectionHeader}>WHY YOU'LL LOVE IT</h3>
                <div className={productStyles.featuresGrid}>
                  {featuresList.map((feat, idx) => (
                    <div key={idx} className={productStyles.featureCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px dashed #444', padding: '1rem', background: '#111' }}>
                      <input
                        type="text"
                        value={feat.title}
                        onChange={(e) => handleUpdateFeature(idx, 'title', e.target.value)}
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#fff', fontSize: '1rem', fontWeight: 'bold', outline: 'none', width: '100%', paddingBottom: '0.2rem' }}
                      />
                      <textarea
                        value={feat.description}
                        onChange={(e) => handleUpdateFeature(idx, 'description', e.target.value)}
                        rows={3}
                        style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '0.8rem', outline: 'none', width: '100%', resize: 'none', lineHeight: '1.4' }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          {/* Fabric Specifications Section Editor */}
          <div style={{ borderTop: '1px solid #222', marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '0.5rem 1rem', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Fabric Specifications Banner</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showSpecs}
                  onChange={(e) => setShowSpecs(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{showSpecs ? '👁️ Section Enabled' : '👁️‍🗨️ Section Hidden'}</span>
              </label>
            </div>
            <div style={{ opacity: showSpecs ? 1 : 0.3, transition: 'opacity 0.2s ease', pointerEvents: showSpecs ? 'auto' : 'none', padding: '3rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
              <section className={productStyles.specsSection}>
                <h3 className={productStyles.sectionHeader}>FABRIC DETAILS</h3>
                <div className={productStyles.specsGrid}>
                  <div className={productStyles.specCard} style={{ border: '1px dashed #444', padding: '1rem' }}>
                    <span className={productStyles.specLabel}>MATERIAL</span>
                    <input
                      type="text"
                      value={materialSpec}
                      onChange={(e) => setMaterialSpec(e.target.value)}
                      placeholder="100% Airlume Combed Cotton"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'center', outline: 'none', width: '100%', padding: '2px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div className={productStyles.specCard} style={{ border: '1px dashed #444', padding: '1rem' }}>
                    <span className={productStyles.specLabel}>WEIGHT</span>
                    <input
                      type="text"
                      value={weightSpec}
                      onChange={(e) => setWeightSpec(e.target.value)}
                      placeholder="240 GSM Heavyweight Knit"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'center', outline: 'none', width: '100%', padding: '2px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div className={productStyles.specCard} style={{ border: '1px dashed #444', padding: '1rem' }}>
                    <span className={productStyles.specLabel}>FIT SILHOUETTE</span>
                    <input
                      type="text"
                      value={fitSpec}
                      onChange={(e) => setFitSpec(e.target.value)}
                      placeholder="Double-Needle Ribbed Collar"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'center', outline: 'none', width: '100%', padding: '2px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div className={productStyles.specCard} style={{ border: '1px dashed #444', padding: '1rem' }}>
                    <span className={productStyles.specLabel}>ORIGIN / DESIGN</span>
                    <input
                      type="text"
                      value={originSpec}
                      onChange={(e) => setOriginSpec(e.target.value)}
                      placeholder="Direct-To-Garment Ink Fusion"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'center', outline: 'none', width: '100%', padding: '2px', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Comparison Table Section Editor */}
          <div style={{ borderTop: '1px solid #222', marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '0.5rem 1rem', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Brand Comparison Table</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showComparison}
                  onChange={(e) => setShowComparison(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{showComparison ? '👁️ Section Enabled' : '👁️‍🗨️ Section Hidden'}</span>
              </label>
            </div>
            <div style={{ opacity: showComparison ? 1 : 0.3, transition: 'opacity 0.2s ease', pointerEvents: showComparison ? 'auto' : 'none', padding: '3rem 1rem', maxWidth: '900px', margin: '0 auto' }}>
              <section className={productStyles.comparisonSection}>
                <h3 className={productStyles.sectionHeader}>GERKINK VS. THE REST</h3>
                <div className={productStyles.tableWrapper}>
                  <table className={productStyles.comparisonTable}>
                    <thead>
                      <tr>
                        <th>FEATURE</th>
                        <th>GERKINK SPEC</th>
                        <th>GENERIC BRAND</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              type="text"
                              value={row.feature}
                              onChange={(e) => handleUpdateComparisonRow(idx, 'feature', e.target.value)}
                              style={{ background: 'transparent', border: '1px dashed #444', color: '#fff', outline: 'none', width: '100%', fontSize: '0.8rem', padding: '4px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={row.us}
                              onChange={(e) => handleUpdateComparisonRow(idx, 'us', e.target.value)}
                              style={{ background: 'transparent', border: '1px dashed #444', color: '#fff', outline: 'none', width: '100%', fontSize: '0.8rem', padding: '4px' }}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={row.them}
                                onChange={(e) => handleUpdateComparisonRow(idx, 'them', e.target.value)}
                                style={{ background: 'transparent', border: '1px dashed #444', color: '#888', outline: 'none', flex: 1, fontSize: '0.8rem', padding: '4px' }}
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteComparisonRow(idx)}
                                style={{ background: 'var(--accent)', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 6px', fontSize: '0.7rem' }}
                                title="Delete row"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={handleAddComparisonRow}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '1rem', cursor: 'pointer' }}
                >
                  + Add Comparison Row
                </button>
              </section>
            </div>
          </div>

          {/* UGC Video Slider Section Editor */}
          <div style={{ borderTop: '1px solid #222', marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '0.5rem 1rem', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Customer Stories UGC Video Slider</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showUgc}
                  onChange={(e) => setShowUgc(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{showUgc ? '👁️ Section Enabled' : '👁️‍🗨️ Section Hidden'}</span>
              </label>
            </div>
            <div style={{ opacity: showUgc ? 1 : 0.3, transition: 'opacity 0.2s ease', pointerEvents: showUgc ? 'auto' : 'none', padding: '3rem 1rem' }}>
              <section className={productStyles.ugcVideoSection}>
                <div className={productStyles.ugcVideoTitleRow}>
                  <h3 className={productStyles.ugcVideoTitle}>Real customer stories</h3>
                  <div className={productStyles.ugcVideoSubtitle}>
                    ★★★★★ 4.65 ★ (23)
                  </div>
                </div>

                <div ref={ugcSliderRef} className={productStyles.ugcVideoSlider}>
                  {displayUgcVideos.map((video, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (ugcVideosList.length > 0) {
                            setUgcVideosList(prev => prev.filter((_, i) => i !== idx));
                          } else {
                            setUgcVideosList(defaultUgcVideos.filter((_, i) => i !== idx));
                          }
                        }}
                        style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}
                        title="Delete story"
                      >
                        ✕
                      </button>
                      <UgcVideoCardPreview
                        video={video}
                        isActive={idx === activeUgcIndex}
                      />
                    </div>
                  ))}
                </div>

                <div className={productStyles.ugcSliderControls}>
                  <button
                    type="button"
                    className={productStyles.ugcArrowBtn}
                    onClick={handleUgcPrev}
                  >
                    ⟨
                  </button>
                  <button
                    type="button"
                    className={productStyles.ugcArrowBtn}
                    onClick={handleUgcNext}
                  >
                    ⟩
                  </button>
                </div>

                {/* Inline form to add review card */}
                <div style={{ maxWidth: '600px', margin: '2rem auto 0 auto', background: '#111', padding: '1rem', border: '1px dotted #444', borderRadius: '4px' }}>
                  <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.5rem' }}>+ Add Custom Video Review Card</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      id="visual-new-ugc-name"
                      placeholder="Customer Name (e.g. Sarah K.)"
                      style={{ background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '0.8rem', padding: '0.5rem' }}
                    />
                    <select
                      id="visual-new-ugc-stars"
                      style={{ background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '0.8rem', padding: '0.5rem' }}
                    >
                      <option value="5">5 Stars</option>
                      <option value="4">4 Stars</option>
                      <option value="3">3 Stars</option>
                      <option value="2">2 Stars</option>
                      <option value="1">1 Star</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="url"
                      id="visual-new-ugc-url"
                      placeholder="Video MP4 URL (https://...)"
                      style={{ background: '#0a0a0a', border: '1px solid #333', color: '#fff', fontSize: '0.8rem', padding: '0.5rem', flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nameEl = document.getElementById('visual-new-ugc-name') as HTMLInputElement;
                        const starsEl = document.getElementById('visual-new-ugc-stars') as HTMLSelectElement;
                        const urlEl = document.getElementById('visual-new-ugc-url') as HTMLInputElement;

                        if (nameEl && urlEl && nameEl.value.trim() && urlEl.value.trim()) {
                          setUgcVideosList(prev => [
                            ...prev,
                            {
                              name: nameEl.value.trim(),
                              stars: Number(starsEl.value) || 5,
                              videoUrl: urlEl.value.trim()
                            }
                          ]);
                          nameEl.value = '';
                          urlEl.value = '';
                          toast('UGC Video added visually!', 'success');
                        } else {
                          toast('Please enter Name and Video URL.', 'error');
                        }
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Add Video
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* FAQ Accordion Section Editor */}
          <div style={{ borderTop: '1px solid #222', marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '0.5rem 1rem', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Common FAQ Accordions</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showFaq}
                  onChange={(e) => setShowFaq(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{showFaq ? '👁️ Section Enabled' : '👁️‍🗨️ Section Hidden'}</span>
              </label>
            </div>
            <div style={{ opacity: showFaq ? 1 : 0.3, transition: 'opacity 0.2s ease', pointerEvents: showFaq ? 'auto' : 'none', padding: '3rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
              <section className={productStyles.faqSection}>
                <h3 className={productStyles.sectionHeader}>COMMON INQUIRIES</h3>
                <div className={productStyles.faqContainer}>
                  {faqsList.map((faq, i) => (
                    <div key={i} className={productStyles.faqItem} style={{ border: '1px dashed #444', padding: '0.75rem', background: '#111', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={faq.q}
                          onChange={(e) => handleUpdateFaq(i, 'q', e.target.value)}
                          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold', outline: 'none', flex: 1, padding: '2px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteFaq(i)}
                          style={{ background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: '0.75rem' }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ marginTop: '0.5rem', borderTop: '1px solid #222', paddingTop: '0.5rem' }}>
                        <textarea
                          value={faq.a}
                          onChange={(e) => handleUpdateFaq(i, 'a', e.target.value)}
                          rows={3}
                          style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '0.85rem', outline: 'none', width: '100%', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddFaq}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '1rem', cursor: 'pointer' }}
                  >
                    + Add New FAQ Accordion
                  </button>
                </div>
              </section>
            </div>
          </div>

          {/* Floating Save/Cancel bar at bottom */}
          <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(18, 18, 18, 0.95)', border: '1px solid #333', padding: '0.75rem 1.5rem', borderRadius: '40px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', gap: '1rem', backdropFilter: 'blur(10px)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#888', borderRight: '1px solid #333', paddingRight: '1rem', fontWeight: 'bold' }}>
              UNSAVED CHANGES
            </span>
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 1.25rem', borderRadius: '20px' }}>
              Cancel
            </button>
            <button type="button" onClick={() => handleSubmit()} disabled={submitting || uploading} className="btn btn-primary btn-sm" style={{ padding: '0.4rem 1.5rem', borderRadius: '20px' }}>
              {submitting ? 'Saving...' : 'Save Product →'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        Loading form context...
      </div>
    }>
      <EditProductForm />
    </Suspense>
  );
}
