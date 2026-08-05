'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useRoast } from '@/hooks/useRoast';
import { useCurrency } from '@/context/CurrencyContext';
import { getCartRoast } from '@/lib/utils/roasts';
import PriceTag from '@/components/ui/PriceTag';
import type { Product, Variant } from '@/types';
import { sortSizes, getSmallVariant } from '@/lib/utils/sizes';
import styles from './ProductDetailClient.module.css';
import { useAuth } from '@/hooks/useAuth';
import RazorpayButton from '@/components/checkout/RazorpayButton';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import ProductCard from '@/components/ui/ProductCard';

const ugcVideos = [
  {
    name: "Doria Von",
    stars: 5,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    name: "Terrance O'Hara",
    stars: 5,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
  {
    name: "Kiana Jacobi",
    stars: 5,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  },
  {
    name: "Sheron Kub",
    stars: 5,
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  }
];

function UgcVideoCard({ video, isActive }: { video: typeof ugcVideos[0]; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  };

  return (
    <div 
      className={`${styles.ugcVideoCard} ${isActive ? styles.ugcVideoCardActive : ''}`}
      onClick={handleTogglePlay}
    >
      <video
        ref={videoRef}
        src={video.videoUrl}
        loop
        muted
        playsInline
        className={styles.ugcVideoElement}
      />
      {!isPlaying && (
        <div className={styles.ugcPlayOverlay}>
          <div className={styles.ugcPlayIcon}>▶</div>
        </div>
      )}
      <div className={styles.ugcVideoInfo}>
        <div className={styles.ugcVideoStars}>★★★★★</div>
        <div className={styles.ugcVideoName}>{video.name}</div>
      </div>
    </div>
  );
}

interface ProductDetailClientProps {
  product: Product;
  recommendedProducts?: Product[];
}

export function ProductDetailClient({ product, recommendedProducts = [] }: ProductDetailClientProps) {
  const { addItem } = useCart();
  const { toast } = useRoast();
  const { user, firebaseUser } = useAuth();
  const { formatPrice } = useCurrency();
  const router = useRouter();

  const displayUgcVideos = useMemo(() => {
    return product.ugcVideos && product.ugcVideos.length > 0 ? product.ugcVideos : ugcVideos;
  }, [product.ugcVideos]);

  const displayFeatures = useMemo(() => {
    return product.featuresList && product.featuresList.length > 0 ? product.featuresList : [
      { title: "Premium Fabric", description: "Spun from high-density yarns to provide maximum structural stiffness and lookbook aesthetics." },
      { title: "Fade Resistant", description: "Advanced ink injection guarantees prints won't peel, crack, or fade over time." },
      { title: "Double Stitched", description: "Double-needle stitching at stress points ensures durability that survives the test of daily wear." },
      { title: "Heavyweight GSM", description: "Thicker fabric weight hangs naturally off the shoulders for a modern premium drape." },
      { title: "Oversized Fit", description: "Engineered streetwear silhouette optimized to flow naturally without clamping your movement." },
      { title: "Breathable Knit", description: "Cotton loops permit dynamic ventilation so you remain comfortable regardless of weather." }
    ];
  }, [product.featuresList]);

  const displayComparisonRows = useMemo(() => {
    return product.comparisonRows && product.comparisonRows.length > 0 ? product.comparisonRows : [
      { feature: "Fabric weight", us: "240GSM (Ultra Heavyweight)", them: "140GSM (Thin & flimsy)" },
      { feature: "Print durability", us: "Zero-crack ink injection", them: "Plastic prints that peel and split" },
      { feature: "Fabric source", us: "WRAP-Certified Ethical Knitwear", them: "Mass-produced low-cost sweatshops" },
      { feature: "Collar build", us: "Double-needle ribbed shape lock", them: "Single-stitch that sags after one wash" }
    ];
  }, [product.comparisonRows]);

  const displayFaqs = useMemo(() => {
    return product.faqsList && product.faqsList.length > 0 ? product.faqsList : [
      { q: "WHEN WILL MY ORDER SHIP?", a: "We process and ship all orders within 24-48 business hours. You will receive an automated tracking code as soon as the shipping carrier scans the parcel." },
      { q: "HOW SHOULD I WASH GERKINK GARMENTS?", a: "To preserve print durability and fabric weight, wash inside out with cold water on a delicate cycle. Hang dry or tumble dry low. Do not iron directly on the graphics." },
      { q: "WHAT IS YOUR RETURN POLICY?", a: "We accept returns for store credit or refunds on all unworn, unwashed items within 14 days of delivery. Pre-booked deposits on custom orders remain non-refundable." },
      { q: "ARE SIZES TRUE TO STREETWEAR MEASUREMENTS?", a: "All garments fit slightly oversized/relaxed off the shoulder. If you prefer a standard fitted silhouette, order one size down." }
    ];
  }, [product.faqsList]);
  const initialVariant = useMemo(() => getSmallVariant(product.variants) || product.variants[0], [product.variants]);
  const [selectedVariant, setSelectedVariant] = useState<Variant>(initialVariant);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Lightbox and Guide States
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({});

  const [mobileImageIndex, setMobileImageIndex] = useState(0);
  const [activeUgcIndex, setActiveUgcIndex] = useState(2);
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

  // Accordion state
  const [descOpen, setDescOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [commitmentOpen, setCommitmentOpen] = useState(false);

  // Buy trigger reference for scroll tracking
  const buySectionRef = useRef<HTMLDivElement>(null);

  // Scroll handler for sticky mobile CTA
  useEffect(() => {
    const handleScroll = () => {
      if (!buySectionRef.current) return;
      const rect = buySectionRef.current.getBoundingClientRect();
      setShowStickyBar(rect.bottom < 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Description text split parser
  const descriptionText = useMemo(() => {
    return product.description.split(/Product features|Care instructions/i)[0]?.trim() || product.description;
  }, [product.description]);

  const productFeatures = useMemo(() => {
    const match = product.description.match(/Product features([\s\S]*?)(?:Care instructions|$)/i);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0 && !line.includes('<br'));
  }, [product.description]);

  const careInstructions = useMemo(() => {
    const match = product.description.match(/Care instructions([\s\S]*?)$/i);
    if (!match) return [];
    return match[1]
      .split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0 && !line.includes('<br'));
  }, [product.description]);

  const priceNum = selectedVariant?.price ?? product.price;


  // Prebooking state
  const [showPrebookModal, setShowPrebookModal] = useState(false);
  const [prebookName, setPrebookName] = useState('');
  const [prebookEmail, setPrebookEmail] = useState('');
  const [prebookMessage, setPrebookMessage] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [prebookLoading, setPrebookLoading] = useState(false);
  const [prebookOrderData, setPrebookOrderData] = useState<{
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setPrebookName(user.displayName || '');
      setPrebookEmail(user.email || '');
    }
  }, [user]);

  const handleAdd = () => {
    if (!selectedVariant) return;
    addItem(product, selectedVariant, quantity);
    toast(getCartRoast(), 'success');
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (!selectedVariant) return;
    addItem(product, selectedVariant, quantity);
    router.push('/checkout');
  };

  const handlePrebookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prebookName || !prebookEmail) {
      toast('Please enter your name and email.', 'error');
      return;
    }
    if (!agreedToTerms) {
      toast('You must agree to the non-refundable deposit terms.', 'error');
      return;
    }
    setPrebookLoading(true);
    try {
      const res = await fetch('/api/payment/create-prebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant.id,
          name: prebookName,
          email: prebookEmail,
          message: prebookMessage,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create pre-booking.');
      }

      const data = await res.json();
      setPrebookOrderData(data);
    } catch (err: any) {
      toast(err.message || 'Something went wrong.', 'error');
    } finally {
      setPrebookLoading(false);
    }
  };

  // Group variants by color for size selection (memoized)
  const colors = useMemo(() => {
    return [...new Set(product.variants.map((v) => v.color))];
  }, [product.variants]);

  const sizes = useMemo(() => {
    const raw = [...new Set(
      product.variants
        .filter((v) => v.color === selectedVariant?.color)
        .map((v) => v.size)
    )];
    return sortSizes(raw);
  }, [product.variants, selectedVariant?.color]);

  const smallPrice = useMemo(() => {
    const small = getSmallVariant(product.variants);
    return small ? small.price : product.price;
  }, [product.variants, product.price]);

  const displayedImages = useMemo(() => {
    if (!selectedVariant?.color) return product.images;
    const activeColorVariants = product.variants.filter((v) => v.color === selectedVariant.color);
    const colorImageUrls = activeColorVariants.flatMap((v) => v.images || []).filter(Boolean);
    const uniqueColorUrls = [...new Set(colorImageUrls)];
    return uniqueColorUrls.length > 0 ? uniqueColorUrls : product.images;
  }, [product.images, product.variants, selectedVariant?.color]);

  const media = useMemo(() => {
    return [
      ...displayedImages.map((url) => ({ type: 'image' as const, url })),
      ...(product.videos || []).map((url) => ({ type: 'video' as const, url })),
    ];
  }, [displayedImages, product.videos]);

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Mobile Carousel (Horizontal Slider with Left/Right Arrows) - Mobile Only */}
        <div className={styles.mobileCarousel}>
          {media.length === 0 ? (
            <div className={styles.carouselItem}>
              <div className={styles.imgPlaceholder}>GERKINK</div>
            </div>
          ) : (
            <div className={styles.carouselWrapper}>
              {/* Left Arrow */}
              {media.length > 1 && (
                <button
                  type="button"
                  className={`${styles.carouselArrow} ${styles.arrowLeft}`}
                  onClick={() => setMobileImageIndex((prev) => (prev - 1 + media.length) % media.length)}
                  aria-label="Previous image"
                >
                  ←
                </button>
              )}

              {/* Slide Image */}
              <div className={styles.carouselItem} onClick={() => setLightboxImage(media[mobileImageIndex]?.url)}>
                {media[mobileImageIndex]?.type === 'video' ? (
                  <video
                    src={media[mobileImageIndex].url}
                    controls
                    loop
                    muted
                    autoPlay
                    playsInline
                    className={styles.carouselMedia}
                  />
                ) : (
                  <Image
                    src={media[mobileImageIndex]?.url}
                    alt={`${product.title} - Slide ${mobileImageIndex + 1}`}
                    fill
                    sizes="100vw"
                    className={styles.carouselMedia}
                    priority
                  />
                )}
              </div>

              {/* Right Arrow */}
              {media.length > 1 && (
                <button
                  type="button"
                  className={`${styles.carouselArrow} ${styles.arrowRight}`}
                  onClick={() => setMobileImageIndex((prev) => (prev + 1) % media.length)}
                  aria-label="Next image"
                >
                  →
                </button>
              )}

              {/* Indicator Dot/Text */}
              {media.length > 1 && (
                <div className={styles.carouselIndicator}>
                  {mobileImageIndex + 1} / {media.length}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image/Video Gallery (Mosaic Grid) - Desktop Only */}
        <div className={styles.galleryGrid}>
          {media.length === 0 ? (
            <div className={`${styles.galleryItem} ${styles.gridItemFull}`}>
              <div className={styles.imgPlaceholder}>GERKINK</div>
            </div>
          ) : (
            media.map((item, index) => {
              let itemClass = styles.gridItemHalf;
              const pos = index % 5;
              if (pos === 2 || pos === 3 || pos === 4) {
                itemClass = styles.gridItemThird;
              }
              if (media.length === 1) {
                itemClass = styles.gridItemFull;
              }

              return (
                <div
                  key={index}
                  className={`${styles.galleryItem} ${itemClass}`}
                  onClick={() => setLightboxImage(item.url)}
                  style={{ cursor: 'zoom-in' }}
                >
                  {item.type === 'video' ? (
                    <video
                      src={item.url}
                      controls
                      loop
                      muted
                      autoPlay
                      playsInline
                      className={styles.galleryMedia}
                    />
                  ) : (
                    <Image
                      src={item.url}
                      alt={`${product.title} - View ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className={styles.galleryMedia}
                      priority={index === 0}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Product Info Column */}
        <div className={styles.info} ref={buySectionRef}>
          <div className={styles.infoTop}>
            <div className={styles.breadcrumb}>
              <Link href="/shop">Shop</Link>
              <span>→</span>
              <Link href={`/shop/${product.section === 'society_fuckers' ? 'society-fuckers' : 'valueless-bitches'}`}>
                {product.section === 'society_fuckers' ? 'Society Fu*kers' : 'Valueless Bi*ches'}
              </Link>
            </div>

            <div className={styles.seasonTag}>NEW SEASON</div>

            <div className={styles.titleRatingRow}>
              <h1 className={styles.title}>{product.title}</h1>
              <div className={styles.reviewStarsSummary} onClick={() => {
                const el = document.getElementById('reviews-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}>
                ★★★★★ <span className={styles.reviewCount}>(42)</span>
              </div>
            </div>

            <PriceTag
              price={selectedVariant?.price ?? smallPrice}
              tier={product.tier}
              size="xl"
              animate
            />

            {/* Short Benefits Bullet Grid */}
            <div className={styles.shortBenefits}>
              <div className={styles.benefitItem}>✦ Premium Heavyweight Fabric</div>
              <div className={styles.benefitItem}>✦ Oversized Streetwear Fit</div>
              <div className={styles.benefitItem}>✦ Fade Resistant Print</div>
              <div className={styles.benefitItem}>✦ Built For Everyday Wear</div>
            </div>
          </div>

          {/* Variant Selection */}
          {colors.length > 1 && (
            <div className={styles.variantGroup}>
              <label className="input-label">Color — {selectedVariant?.color}</label>
              <div className={styles.colorSwatches}>
                {colors.map((color) => {
                  const v = product.variants.find((variant) => variant.color === color);
                  if (!v) return null;
                  return (
                    <button
                      key={color}
                      className={`${styles.swatch} ${selectedVariant?.color === color ? styles.swatchActive : ''}`}
                      onClick={() => {
                        const matching = product.variants.find(
                          (pv) => pv.color === color && pv.size === selectedVariant?.size
                        ) ?? v;
                        setSelectedVariant(matching);
                        setMobileImageIndex(0);
                      }}
                      style={{ background: v.colorHex ?? 'var(--fog)' }}
                      aria-label={`Color: ${color}`}
                      title={color}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.variantGroup}>
            <div className={styles.sizeHeaderRow}>
              <label className="input-label">Size — {selectedVariant?.size}</label>
              <button
                type="button"
                className={styles.sizeGuideLink}
                onClick={() => setShowSizeGuide(true)}
              >
                Size Guide
              </button>
            </div>
            <div className={styles.sizes}>
              {sizes.map((size) => {
                const v = product.variants.find(
                  (pv) => pv.size === size && pv.color === selectedVariant?.color
                );
                return (
                  <button
                    key={size}
                    disabled={!v?.available}
                    className={`${styles.sizeBtn} ${selectedVariant?.size === size ? styles.sizeBtnActive : ''}`}
                    onClick={() => v && setSelectedVariant(v)}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            {/* Sizing Recommendation */}
            <div className={styles.sizeRecommendation}>
              {product.fitRecommendation || "Model is 6'1\" wearing size XL (Fits Oversized)"}
            </div>
          </div>

          {/* Quantity Selector */}
          <div className={styles.variantGroup}>
            <label className="input-label">Quantity</label>
            <div className={styles.qtySelector}>
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className={styles.qtyVal}>{quantity}</span>
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={() => setQuantity((q) => q + 1)}
              >
                +
              </button>
            </div>
          </div>

          {/* Checkout CTAs */}
          <div className={styles.actionsBlock}>
            {product.section === 'society_fuckers' ? (
              <button
                className={`btn btn-primary btn-lg btn-full ${styles.addBtn}`}
                onClick={() => setShowPrebookModal(true)}
                disabled={!selectedVariant?.available}
              >
                Pre-book Now — {formatPrice(product.prebookingPrice !== undefined && product.prebookingPrice !== null ? product.prebookingPrice : 500)}
              </button>
            ) : (
              <>
                <button
                  className={`btn btn-primary btn-lg btn-full ${styles.addBtn}`}
                  onClick={handleAdd}
                  disabled={!selectedVariant?.available}
                >
                  <span style={{ marginRight: '0.5rem' }}>🛍️</span>
                  {added
                    ? 'Added to Bag'
                    : selectedVariant?.available
                    ? 'ADD TO BAG'
                    : 'Out of Stock'}
                </button>
                {selectedVariant?.available && (
                  <button
                    className={`${styles.buyNowBtn}`}
                    onClick={handleBuyNow}
                  >
                    BUY NOW
                  </button>
                )}
              </>
            )}
          </div>

          {/* Trust Badges */}
          <div className={styles.trustBadgesGrid}>
            <div className={styles.trustBadgeItem}>
              <span className={styles.trustBadgeIcon}>🔒</span>
              <span>Secure Checkout</span>
            </div>
            <div className={styles.trustBadgeItem}>
              <span className={styles.trustBadgeIcon}>📦</span>
              <span>Worldwide Shipping</span>
            </div>
            <div className={styles.trustBadgeItem}>
              <span className={styles.trustBadgeIcon}>🔄</span>
              <span>Easy Returns</span>
            </div>
            <div className={styles.trustBadgeItem}>
              <span className={styles.trustBadgeIcon}>✨</span>
              <span>Premium Quality</span>
            </div>
          </div>

          {/* Logistics Information */}
          <div className={styles.logistics}>
            <div className={styles.logisticsItem}>
              <span className={styles.logisticsIcon}>🚚</span>
              <span>order now, complimentary express delivery by Tue, Sep 9th</span>
            </div>
            <div className={styles.logisticsItem}>
              <span className={styles.logisticsIcon}>🏢</span>
              <span>order now, complimentary collect in store available</span>
            </div>
          </div>

          {/* Collapsible Accordions */}
          <div className={styles.accordionContainer}>
            <div className={styles.drawer}>
              <button
                className={styles.drawerHeader}
                onClick={() => setDescOpen(!descOpen)}
                type="button"
              >
                <span>PRODUCT DESCRIPTION</span>
                <span className={styles.drawerArrow}>{descOpen ? '−' : '+'}</span>
              </button>
              <div className={`${styles.drawerContent} ${descOpen ? styles.drawerContentOpen : ''}`}>
                <p className={styles.descText}>{descriptionText}</p>
              </div>
            </div>

            <div className={styles.drawer}>
              <button
                className={styles.drawerHeader}
                onClick={() => setDetailsOpen(!detailsOpen)}
                type="button"
              >
                <span>PRODUCT DETAILS</span>
                <span className={styles.drawerArrow}>{detailsOpen ? '−' : '+'}</span>
              </button>
              <div className={`${styles.drawerContent} ${detailsOpen ? styles.drawerContentOpen : ''}`}>
                <ul className={styles.detailsList}>
                  {productFeatures.length > 0 ? (
                    productFeatures.map((f, i) => <li key={i}>{f}</li>)
                  ) : (
                    <>
                      <li>Premium direct-to-garment printing quality</li>
                      <li>Relaxed, streetwear-ready fit</li>
                      <li>Ethically sourced fabrics</li>
                    </>
                  )}
                </ul>
                {careInstructions.length > 0 && (
                  <div className={styles.careSection}>
                    <strong className={styles.careTitle}>Care Instructions</strong>
                    <ul className={styles.detailsList}>
                      {careInstructions.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.drawer}>
              <button
                className={styles.drawerHeader}
                onClick={() => setCommitmentOpen(!commitmentOpen)}
                type="button"
              >
                <span>OUR COMMITMENT</span>
                <span className={styles.drawerArrow}>{commitmentOpen ? '−' : '+'}</span>
              </button>
              <div className={`${styles.drawerContent} ${commitmentOpen ? styles.drawerContentOpen : ''}`}>
                <p className={styles.commitmentText}>
                  {product.commitmentText || "GERKINK stands for zero apologies and unapologetic self-expression. We produce all pieces in limited quantities to prevent overproduction and waste."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Brand Manifesto Section */}
      {product.showManifesto !== false && (
        <section className={styles.manifestoSection}>
          <div className={styles.manifestoQuote}>
            {product.manifestoQuote || `"WE DO NOT FIT IN. WE DO NOT APOLOGIZE. WE DEFINE THE CHAOS."`}
          </div>
          <p className={styles.manifestoBody}>
            {product.manifestoBody || `GERKINK was born in the shadows of fast-fashion mediocrity. Every garment is a heavy-knit canvas designed to withstand the wear of the streets and outlast fleeting trends. We produce in strictly limited runs to combat waste and preserve absolute exclusivity. You aren't just buying a piece; you're joining the resistance.`}
          </p>
        </section>
      )}

      {/* Editorial Lifestyle Banner */}
      <section className={styles.lifestyleBanner}>
        <div className={styles.lifestyleContent}>
          <h2 className={styles.lifestyleTitle}>BUILT TO OUTLAST TRENDS</h2>
          <p className={styles.lifestyleSub}>DESIGNED TO DISAPPEAR INTO YOUR DAILY UNIFORM.</p>
        </div>
      </section>

      {/* "Why You'll Love It" Grid */}
      {product.showFeatures !== false && (
        <section className={styles.featuresSection}>
          <h3 className={styles.sectionHeader}>WHY YOU'LL LOVE IT</h3>
          <div className={styles.featuresGrid}>
            {displayFeatures.map((feat, idx) => (
              <div key={idx} className={styles.featureCard}>
                <h4>{feat.title}</h4>
                <p>{feat.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fabric Technical Details */}
      {product.showSpecs !== false && (
        <section className={styles.specsSection}>
          <h3 className={styles.sectionHeader}>FABRIC DETAILS</h3>
          <div className={styles.specsGrid}>
            <div className={styles.specCard}>
              <span className={styles.specLabel}>MATERIAL</span>
              <span className={styles.specVal}>{product.materialSpec || "100% Airlume Combed Cotton"}</span>
            </div>
            <div className={styles.specCard}>
              <span className={styles.specLabel}>WEIGHT</span>
              <span className={styles.specVal}>{product.weightSpec || "240 GSM Heavyweight Knit"}</span>
            </div>
            <div className={styles.specCard}>
              <span className={styles.specLabel}>FIT SILHOUETTE</span>
              <span className={styles.specVal}>{product.fitSpec || "Double-Needle Ribbed Collar"}</span>
            </div>
            <div className={styles.specCard}>
              <span className={styles.specLabel}>ORIGIN / DESIGN</span>
              <span className={styles.specVal}>{product.originSpec || "Direct-To-Garment Ink Fusion"}</span>
            </div>
          </div>
        </section>
      )}

      {/* Comparison Grid */}
      {product.showComparison !== false && (
        <section className={styles.comparisonSection}>
          <h3 className={styles.sectionHeader}>GERKINK VS. THE REST</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>FEATURE</th>
                  <th>GERKINK SPEC</th>
                  <th>GENERIC BRAND</th>
                </tr>
              </thead>
              <tbody>
                {displayComparisonRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.feature}</td>
                    <td>{row.us}</td>
                    <td>{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Real Customer Stories UGC Video Section */}
      {product.showUgc !== false && displayUgcVideos.length > 0 && (
        <section className={styles.ugcVideoSection}>
          <div className={styles.ugcVideoTitleRow}>
            <h3 className={styles.ugcVideoTitle}>Real customer stories</h3>
            <div className={styles.ugcVideoSubtitle}>
              ★★★★★ 4.65 ★ (23)
            </div>
          </div>
          <div ref={ugcSliderRef} className={styles.ugcVideoSlider}>
            {displayUgcVideos.map((video, idx) => (
              <UgcVideoCard
                key={idx}
                video={video}
                isActive={idx === activeUgcIndex}
              />
            ))}
          </div>
          <div className={styles.ugcSliderControls}>
            <button
              type="button"
              className={styles.ugcArrowBtn}
              onClick={handleUgcPrev}
              aria-label="Previous story"
            >
              ⟨
            </button>
            <button
              type="button"
              className={styles.ugcArrowBtn}
              onClick={handleUgcNext}
              aria-label="Next story"
            >
              ⟩
            </button>
          </div>
        </section>
      )}

      {/* Reviews Integration */}
      <section id="reviews-section" className={styles.reviewsSection}>
        <h3 className={styles.sectionHeader}>CUSTOMER FEEDBACK</h3>
        <ReviewsSection />
      </section>

      {/* FAQ Section */}
      {product.showFaq !== false && (
        <section className={styles.faqSection}>
          <h3 className={styles.sectionHeader}>COMMON INQUIRIES</h3>
          <div className={styles.faqContainer}>
            {displayFaqs.map((faq, i) => (
              <div key={i} className={styles.faqItem}>
                <button
                  type="button"
                  className={styles.faqHeader}
                  onClick={() => setFaqOpen(prev => ({ ...prev, [i]: !prev[i] }))}
                >
                  <span>{faq.q}</span>
                  <span>{faqOpen[i] ? '−' : '+'}</span>
                </button>
                <div className={`${styles.faqBody} ${faqOpen[i] ? styles.faqBodyOpen : ''}`}>
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sibling Products / Complete The Look */}
      {recommendedProducts.length > 0 && (
        <section className={styles.recommendationsSection}>
          <h3 className={styles.sectionHeader}>COMPLETE THE LOOK</h3>
          <div className={styles.recommendationsGrid}>
            {recommendedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxImage(null)}>
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightboxImage(null)}
          >
            ✕
          </button>
          <div className={styles.lightboxFrame} onClick={(e) => e.stopPropagation()}>
            <Image src={lightboxImage} alt="Full Resolution View" fill className={styles.lightboxImg} />
          </div>
        </div>
      )}

      {/* Size Guide Modal */}
      {showSizeGuide && (
        <div className={styles.sizeGuideOverlay} onClick={() => setShowSizeGuide(false)}>
          <div className={styles.sizeGuideModal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.sizeGuideClose}
              onClick={() => setShowSizeGuide(false)}
            >
              ✕
            </button>
            <h3 className={styles.sizeGuideTitle}>GERKINK SIZE GUIDE</h3>
            <p className={styles.sizeGuideSub}>Streetwear relaxed fit. All dimensions shown in inches.</p>
            <table className={styles.sizeGuideTable}>
              <thead>
                <tr>
                  <th>SIZE</th>
                  <th>CHEST WIDTH</th>
                  <th>BODY LENGTH</th>
                  <th>SLEEVE LENGTH</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>S</td>
                  <td>20"</td>
                  <td>26"</td>
                  <td>32.5"</td>
                </tr>
                <tr>
                  <td>M</td>
                  <td>22"</td>
                  <td>27"</td>
                  <td>33.5"</td>
                </tr>
                <tr>
                  <td>L</td>
                  <td>24"</td>
                  <td>28"</td>
                  <td>34.5"</td>
                </tr>
                <tr>
                  <td>XL</td>
                  <td>26"</td>
                  <td>29"</td>
                  <td>35.5"</td>
                </tr>
                <tr>
                  <td>2XL</td>
                  <td>28"</td>
                  <td>30"</td>
                  <td>36.5"</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky Mobile Add to Cart Bar */}
      {product.section !== 'society_fuckers' && (
        <div className={`${styles.mobileStickyBar} ${showStickyBar ? styles.mobileStickyBarOpen : ''}`}>
          <div className={styles.stickyBarInner}>
            <div className={styles.stickyBarMeta}>
              {media[0]?.url && (
                <div className={styles.stickyBarThumb}>
                  <Image src={media[0].url} alt="" width={40} height={50} style={{ objectFit: 'cover' }} />
                </div>
              )}
              <div className={styles.stickyBarInfo}>
                <span className={styles.stickyBarTitle}>{product.title}</span>
                <span className={styles.stickyBarPrice}>{formatPrice(selectedVariant?.price ?? product.price)}</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.stickyBarBtn}
              onClick={handleAdd}
              disabled={!selectedVariant?.available}
            >
              ADD TO BAG
            </button>
          </div>
        </div>
      )}

      {/* Pre-booking Modal (restored/preserved) */}
      {showPrebookModal && (
        <div className={styles.overlay} onClick={() => {
          if (!prebookLoading && !prebookOrderData) {
            setShowPrebookModal(false);
          }
        }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.modalClose}
              onClick={() => {
                setShowPrebookModal(false);
                setPrebookOrderData(null);
              }}
              disabled={prebookLoading}
            >
              ✕
            </button>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Apply to Pre-book</h2>
              <p className={styles.modalSubtitle}>
                Secure your slot for <strong>{product.title}</strong> by paying the non-refundable pre-booking fee.
                The admin will review your inquiry and contact you to finalize the custom design.
              </p>
            </div>

            {!firebaseUser ? (
              <div className={styles.authNotice}>
                <p className={styles.authNoticeText}>
                  You must be signed in to submit a pre-booking request.
                </p>
                <Link
                  href={`/auth/login?redirect=/shop/${product.id}`}
                  className="btn btn-primary btn-full"
                >
                  Sign In
                </Link>
              </div>
            ) : prebookOrderData ? (
              <div className={styles.paymentContainer}>
                <p className={styles.paymentLabel}>
                  Pre-booking created! Complete your payment of <strong>{formatPrice(product.prebookingPrice !== undefined && product.prebookingPrice !== null ? product.prebookingPrice : 500)}</strong> to finalize.
                </p>
                <RazorpayButton
                  razorpayOrderId={prebookOrderData.razorpayOrderId}
                  amount={prebookOrderData.amount}
                  currency={prebookOrderData.currency}
                  firestoreOrderId={prebookOrderData.orderId}
                  userEmail={prebookEmail}
                  userName={prebookName}
                  isPrebooking={true}
                  amountUSD={product.prebookingPrice !== undefined && product.prebookingPrice !== null ? product.prebookingPrice : 500}
                  onSuccess={() => {
                    setShowPrebookModal(false);
                    setPrebookOrderData(null);
                    setPrebookMessage('');
                  }}
                  onError={(msg) => toast(msg, 'error')}
                />
              </div>
            ) : (
              <form onSubmit={handlePrebookSubmit} className={styles.modalForm}>
                <div>
                  <label htmlFor="prebook-name" className="input-label">Full Name</label>
                  <input
                    id="prebook-name"
                    type="text"
                    className="input"
                    value={prebookName}
                    onChange={(e) => setPrebookName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="prebook-email" className="input-label">Email Address</label>
                  <input
                    id="prebook-email"
                    type="email"
                    className="input"
                    value={prebookEmail}
                    onChange={(e) => setPrebookEmail(e.target.value)}
                    placeholder="e.g. jane@example.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="prebook-message" className="input-label">Inquiry / Customization Notes</label>
                  <textarea
                    id="prebook-message"
                    className="input"
                    rows={4}
                    value={prebookMessage}
                    onChange={(e) => setPrebookMessage(e.target.value)}
                    placeholder="Tell us what you want to talk about regarding the product..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                  />
                  <span>
                    I agree that the pre-booking deposit of {formatPrice(product.prebookingPrice !== undefined && product.prebookingPrice !== null ? product.prebookingPrice : 500)} is <strong>non-refundable</strong> and will be used as credit towards the final product purchase.
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={prebookLoading}
                  className="btn btn-primary btn-lg btn-full"
                >
                  {prebookLoading ? 'Creating Pre-booking...' : 'Proceed to Payment →'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
