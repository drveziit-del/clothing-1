'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/types';
import { useCurrency } from '@/context/CurrencyContext';
import ProductCard from '@/components/ui/ProductCard';
import { BentoGrid, BentoCard } from '@/components/ui/BentoGrid';
import styles from './SocietyFuckersDetailSections.module.css';

interface SocietyFuckersDetailSectionsProps {
  product: Product;
  recommendedProducts?: Product[];
}

interface TierContent {
  tierName: string;
  auraClass: string;
  manifestoClass: string;
  tagClass: string;
  quoteClass: string;
  manifestoTag: string;
  manifestoQuote: string;
  manifestoBody: string;
  protocolSuperTag: string;
  protocolTitle: string;
  protocols: { icon: string; title: string; desc: string }[];
  compTitle: string;
  compHeaders: [string, string, string, string];
  compRows: [string, string, string, string][];
  registryTitle: string;
  registryBadge: string;
  slots: { label: string; status: string }[];
  faqs: { q: string; a: string }[];
}

const TIER_SECTIONS_DATA: Record<number, TierContent> = {
  1: {
    tierName: 'God Tier',
    auraClass: styles.tier1Aura,
    manifestoClass: styles.manifestoGold,
    tagClass: styles.tagGold,
    quoteClass: styles.manifestoQuoteGold,
    manifestoTag: '👑 SOVEREIGN ASSET PHILOSOPHY • TIER 1',
    manifestoQuote: '"YOU DID NOT BUY A GARMENT. YOU PURCHASED THE UNDISPUTED SUMMIT OF SARTORIAL VANITY."',
    manifestoBody: 'There is strictly 1 piece of this masterwork on planet Earth. When acquired, the master vector screens, physical printing dies, and digital blueprint are permanently incinerated in a certified destruction ceremony. No reissues. No secondary editions. Absolute singular dominion.',
    protocolSuperTag: 'THE $10,000,000 DELIVERY & VAULT PROTOCOL',
    protocolTitle: 'Sovereign Custody & Diplomatic Dispatch',
    protocols: [
      {
        icon: '🛡️',
        title: 'Monolithic Titanium Flight Vault',
        desc: 'Waterproof, EMP-shielded, laser-engraved with serial MINT #001/001 and biometric locking latch.',
      },
      {
        icon: '✈️',
        title: 'Armed Diplomatic Transit Operatives',
        desc: 'Two dedicated security professionals fly first-class directly to your coordinates anywhere globally.',
      },
      {
        icon: '👑',
        title: 'Hardware NFC Sovereign Token',
        desc: 'Micro-cryptographic hardware chip embedded in the collar, verifying immutable 1/1 ownership on-chain.',
      },
      {
        icon: '📞',
        title: 'Direct 24/7 Hotline to Founders',
        desc: 'Physical solid-gold engraved card with an unlisted private direct telephone channel to executive design.',
      },
    ],
    compTitle: 'THE SOVEREIGN CAPITAL COMPARISON',
    compHeaders: ['ASSET TYPE', 'GOD TIER 1/1 SHIRT', 'SUPERYACHT CHARTER', 'GULFSTREAM G650'],
    compRows: [
      ['Total Valuation', '$10,000,000.00', '$10,000,000.00', '$10,000,000.00'],
      ['Global Scarcity', '1 of 1 Worldwide', 'Hundreds Chartered', 'Standard Fleet Model'],
      ['Annual Maintenance', '$0.00 (Zero Crew/Fuel)', '$1,200,000 / year', '$2,500,000 / year'],
      ['Audacity Index', 'Astronomical (Off the Charts)', 'Predictable Billionaire', 'Corporate Utility'],
      ['Blueprint Status', 'Incinerated Upon Delivery', 'Mass-Engineered Hull', 'Standard Aerospace'],
    ],
    registryTitle: 'Global Sovereign Mint Registry',
    registryBadge: 'SERIAL #001 / 001 • EDITION 1 OF 1',
    slots: [
      { label: 'SLOT 01 OF 01 (GLOBAL MASTER)', status: 'STATUS: AWAITING SOVEREIGN ALLOCATION' },
    ],
    faqs: [
      {
        q: 'Can I pay via sovereign cryptocurrency or escrow wire transfer?',
        a: 'Yes. We accept Escrow Wire Transfers, Bitcoin, Ethereum, and physical precious metals via our VIP Private Concierge Desk.',
      },
      {
        q: 'What is the Certified Destruction Ceremony?',
        a: 'Upon delivery confirmation, the original Adobe Illustrator vectors, physical test dies, and high-resolution print files are permanently incinerated on live encrypted video.',
      },
      {
        q: 'Can anyone else on Earth ever purchase this exact shirt?',
        a: 'Never. Tier 1 pieces are hard-coded 1-of-1 global editions. Once allocated, this product page is permanently archived in the GERKINK Hall of Sovereign Ownership.',
      },
      {
        q: 'How should a $10,000,000 garment be stored and preserved?',
        a: 'Your piece arrives inside an EMP-shielded, argon-gas-sealed titanium vault. We recommend archival museum-grade display or climate-controlled private vault storage.',
      },
    ],
  },
  2: {
    tierName: 'Obscene',
    auraClass: styles.tier2Aura,
    manifestoClass: styles.manifestoPlatinum,
    tagClass: styles.tagPlatinum,
    quoteClass: styles.manifestoQuotePlatinum,
    manifestoTag: '💎 OBSCENE WEALTH DECLARATION • TIER 2',
    manifestoQuote: '"FOR THOSE WHO HAVE CONQUERED CAPITAL AND RUN OUT OF THINGS TO BURN."',
    manifestoBody: 'Created in an edition of strictly 2 pieces globally. One for you, and one for your only financial peer. A wearable tribute to obscene financial defiance and generational disregard for financial prudence.',
    protocolSuperTag: 'THE $1,000,000 MANUFACTURING SPECIFICATION',
    protocolTitle: 'Archival Metallurgy & VIP Courier Logistics',
    protocols: [
      {
        icon: '📜',
        title: '600GSM Archival Cotton Parchment',
        desc: 'Hand-numbered Certificate of Authenticity on museum-grade rag paper signed personally by the founder.',
      },
      {
        icon: '💎',
        title: 'Sterling Silver Thread Fusion',
        desc: 'Hand-finished seam stress joints woven with micro-filament sterling silver metallic threading.',
      },
      {
        icon: '🌐',
        title: 'Tracked VIP White-Glove Courier',
        desc: 'Hand-carried priority customs clearance and direct personal courier transit to your address.',
      },
      {
        icon: '🏷️',
        title: 'Numbered 2-of-2 Woven Collar Label',
        desc: 'Serialized metallic badge permanently embedded into the neckline ribbing.',
      },
    ],
    compTitle: 'GENERATIONAL CAPITAL COMPARISON',
    compHeaders: ['ASSET TYPE', 'TIER 2 OBSCENE SHIRT', '3x FERRARI SF90 STRADALE', 'MANHATTAN LOFT DOWNPAYMENT'],
    compRows: [
      ['Valuation', '$1,000,000.00', '$1,000,000.00', '$1,000,000.00'],
      ['Worldwide Supply', '2 Pieces Total', 'Mass Manufactured', 'Standard Real Estate'],
      ['Depreciation', 'Zero (Archived Art)', '30% Off The Lot', 'Property Tax Drag'],
      ['Statement Factor', 'Pure Financial Provocation', 'Standard Supercar Flex', 'Boring Asset Class'],
    ],
    registryTitle: 'Dual Sovereign Allocation Registry',
    registryBadge: '2 PIECES WORLDWIDE • EDITION OF 2',
    slots: [
      { label: 'EDITION MINT #001 / 002', status: 'AVAILABLE FOR ALLOCATION' },
      { label: 'EDITION MINT #002 / 002', status: 'AVAILABLE FOR ALLOCATION' },
    ],
    faqs: [
      {
        q: 'Why are there only 2 pieces of this garment worldwide?',
        a: 'Because true rarity cannot exist in three-digit volumes. Two pieces allows two peers on opposite sides of the planet to own the ultimate sartorial statement.',
      },
      {
        q: 'How do I arrange private concierge wire payment?',
        a: 'Click "Speak with Private VIP Concierge" on the product card or submit a pre-booking deposit. Our executive team handles all wire settlement documentation directly.',
      },
      {
        q: 'Is bespoke custom sizing included with Tier 2?',
        a: 'Yes. Upon pre-booking authorization, our master patternmaker will coordinate exact custom garment measurements according to your preference.',
      },
    ],
  },
  3: {
    tierName: 'Delusional',
    auraClass: styles.tier3Aura,
    manifestoClass: '',
    tagClass: styles.tagRose,
    quoteClass: '',
    manifestoTag: '🔥 DELUSIONAL WEALTH MANIFESTO • TIER 3',
    manifestoQuote: '"YOUR FINANCIAL ADVISOR IS CRYING. YOUR ACCOUNTANT IS PREPARING THEIR RESIGNATION."',
    manifestoBody: 'Priced intentionally to inflict psychological damage on rational investors. Strictly 5 pieces worldwide. Wear it to prove that currency is merely an illusion and taste is absolute.',
    protocolSuperTag: 'THE $100,000 COLLECTOR SPECIFICATION',
    protocolTitle: 'Museum Display & Blockchain Cryptography',
    protocols: [
      {
        icon: '📦',
        title: 'Matte Black Acrylic Display Vault',
        desc: 'Museum-grade UV-filtering presentation casing designed for permanent home or office gallery display.',
      },
      {
        icon: '🏷️',
        title: 'NFC Anti-Counterfeit Microchip',
        desc: 'Instant cryptographic smartphone verification verifying genuine 5-piece provenance.',
      },
      {
        icon: '🚨',
        title: 'Framed CPA Distress Certificate',
        desc: 'Satirical official parchment addressed to your certified financial planner confirming deliberate extravagance.',
      },
      {
        icon: '🚀',
        title: 'Priority Tracked Express Dispatch',
        desc: 'Fully insured direct courier dispatch with signature-required security handoff.',
      },
    ],
    compTitle: 'DELUSIONAL REALITY CHECK MATRIX',
    compHeaders: ['ASSET TYPE', 'TIER 3 DELUSIONAL SHIRT', '4-YEAR IVY LEAGUE TUITION', 'PORSCHE 911 GT3 DOWNPAYMENT'],
    compRows: [
      ['Cost', '$100,000.00', '$100,000.00', '$100,000.00'],
      ['Global Supply', '5 Pieces on Earth', 'Tens of Thousands', 'Automotive Assembly Line'],
      ['Conversation Value', 'Guaranteed Shock & Awe', 'Standard Diploma', 'Traffic Congestion'],
      ['Irony Quotient', 'Maximum Luxury Irony', 'Zero Humour', 'Boring Weekend Driver'],
    ],
    registryTitle: '5-Piece Worldwide Allocation Tracker',
    registryBadge: '5 PIECES WORLDWIDE • SERIALIZED #001 - #005',
    slots: [
      { label: 'SERIAL #001 / 005', status: 'AVAILABLE' },
      { label: 'SERIAL #002 / 005', status: 'AVAILABLE' },
      { label: 'SERIAL #003 / 005', status: 'AVAILABLE' },
      { label: 'SERIAL #004 / 005', status: 'AVAILABLE' },
      { label: 'SERIAL #005 / 005', status: 'AVAILABLE' },
    ],
    faqs: [
      {
        q: 'Does this shirt include the custom display vault?',
        a: 'Yes. Every Tier 3 garment arrives housed in a custom matte black UV-filtering acrylic display case suitable for gallery mounting.',
      },
      {
        q: 'How does the NFC authentication chip work?',
        a: 'Simply tap your iPhone or Android smartphone near the hem tag to immediately launch the authenticated cryptographic certificate of authenticity.',
      },
      {
        q: 'What is the pre-booking allocation policy?',
        a: 'A $500 escrow deposit reserves your numbered serial position. 100% of this fee is credited toward the final piece balance.',
      },
    ],
  },
  4: {
    tierName: 'Wannabe',
    auraClass: styles.tier4Aura,
    manifestoClass: '',
    tagClass: styles.tagCoral,
    quoteClass: '',
    manifestoTag: '⚡ WANNABE AUDITION MANIFESTO • TIER 4',
    manifestoQuote: '"THE AUDITION TAPE FOR THE 1% CLUB."',
    manifestoBody: "You aren't a billionaire yet, but you're too reckless to wear ordinary clothing. Strictly 10 pieces worldwide. A 5-figure statement piece designed to establish your disregard for median savings accounts.",
    protocolSuperTag: 'THE $10,000 STREETWEAR ENGINEERING SPEC',
    protocolTitle: 'High-Density Structural Streetwear Architecture',
    protocols: [
      {
        icon: '🛡️',
        title: '240GSM Heavyweight Ring-Spun Cotton',
        desc: 'Ultra-dense organic combed yarns engineered for a structured, oversized boxy streetwear drape.',
      },
      {
        icon: '🪪',
        title: 'Serialized 10-Piece Metallic Label',
        desc: 'Laser-numbered woven identifier in the collar marking your slot in the 10-piece global drop.',
      },
      {
        icon: '🚀',
        title: 'Priority Express Tracked Transit',
        desc: 'Global express dispatch with live courier tracking straight from the master hub.',
      },
      {
        icon: '🎨',
        title: 'Direct Pigment Fusion Injection',
        desc: 'Zero-crack Japanese pigment infusion that penetrates the cotton fibers rather than resting on top.',
      },
    ],
    compTitle: 'WANNABE REALITY CHECK MATRIX',
    compHeaders: ['PURCHASE', 'TIER 4 WANNABE SHIRT', 'FIRST CLASS TOKYO TICKET', 'PRE-OWNED ROLEX SUBMARINER'],
    compRows: [
      ['Price', '$10,000.00', '$10,000.00', '$10,000.00'],
      ['Worldwide Total', '10 Pieces Worldwide', 'Millions of Passengers', 'Mass-Produced Watch'],
      ['Street Presence', 'Unfiltered Ego Flex', 'Jetlag', 'Standard Watch Guy'],
    ],
    registryTitle: '10-Piece Worldwide Allocation Tracker',
    registryBadge: '10 PIECES WORLDWIDE • SERIALIZED #001 - #010',
    slots: [
      { label: 'MINT SLOTS #001 - #005', status: 'AVAILABLE' },
      { label: 'MINT SLOTS #006 - #010', status: 'AVAILABLE' },
    ],
    faqs: [
      {
        q: 'Is this piece meant to be worn or framed?',
        a: 'Both. Crafted from 240GSM structural cotton, it is durable enough for daily streetwear abuse, but rare enough to hang in an art collection.',
      },
      {
        q: 'How do I care for a $10,000 streetwear shirt?',
        a: 'Cold wash inside out with neutral detergent. Hang dry in shade. Do not iron directly over the fused graphic print.',
      },
    ],
  },
  5: {
    tierName: 'Peasant Premium',
    auraClass: styles.tier5Aura,
    manifestoClass: '',
    tagClass: styles.tagSteel,
    quoteClass: '',
    manifestoTag: '🛡️ PEASANT PREMIUM SATIRE • TIER 5',
    manifestoQuote: '"OUR MOST \'ACCESSIBLE\' PIECE. STILL HIGHER THAN YOUR MONTHLY RENT."',
    manifestoBody: 'The ironic entry-point into the Society Fu*kers pantheon. 999 pieces worldwide. Still sufficiently expensive to offend fast-fashion purists and provoke genuine questions from your peers.',
    protocolSuperTag: 'THE $1,000 LUXURY STREETWEAR SPEC',
    protocolTitle: 'Zero-Crack DTG Pigment & Heavyweight Construction',
    protocols: [
      {
        icon: '👕',
        title: 'Zero-Crack Japanese DTG Inks',
        desc: 'Advanced direct-to-garment pigment infusion guaranteeing graphics that never peel, crack, or fade.',
      },
      {
        icon: '🌍',
        title: 'Global Printify Hub Dispatch',
        desc: 'Fulfillment and tracked dispatch from top-tier international production centers.',
      },
      {
        icon: '🧵',
        title: 'Double-Needle Ribbed Collar',
        desc: 'Reinforced collar shape retention that resists stretching after hundreds of washes.',
      },
      {
        icon: '📦',
        title: 'Matte Presentation Unboxing Box',
        desc: 'Custom rigid packaging with anti-static garment bag and collectible certification card.',
      },
    ],
    compTitle: 'PEASANT PREMIUM VALUE COMPARISON',
    compHeaders: ['ITEM', 'TIER 5 PEASANT SHIRT', '3x DESIGNER SNEAKERS', '1 MONTH LUXURY GYM'],
    compRows: [
      ['Price', '$1,000.00', '$1,000.00', '$1,000.00'],
      ['Exclusivity', '999 Pieces Worldwide', 'Mass Re-released', 'Expired in 30 Days'],
      ['Statement', 'Satirical High Luxury', 'Sneakerhead Hype', 'Sore Muscles'],
    ],
    registryTitle: '999-Piece Global Allocation',
    registryBadge: '999 PIECES WORLDWIDE • LIMITED DROP',
    slots: [
      { label: 'GLOBAL SUPPLY', status: '999 TOTAL PIECES WORLDWIDE' },
    ],
    faqs: [
      {
        q: 'Why is Tier 5 priced at $1,000?',
        a: 'To make it the most accessible satirical entry point in the Society Fu*kers collection while remaining strictly limited to 999 pieces.',
      },
      {
        q: 'What is the delivery timeline for Tier 5?',
        a: 'Pre-booked pieces enter our priority production batch and dispatch within 5-7 business days via tracked express shipping.',
      },
    ],
  },
};

export default function SocietyFuckersDetailSections({
  product,
  recommendedProducts = [],
}: SocietyFuckersDetailSectionsProps) {
  const { formatPrice } = useCurrency();
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({});

  const tier = product.tier || 1;
  const data = TIER_SECTIONS_DATA[tier] || TIER_SECTIONS_DATA[1];

  const toggleFaq = (idx: number) => {
    setFaqOpen((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className={`${styles.wrapper} ${data.auraClass}`}>
      {/* 1. Tier-Specific Manifesto Banner */}
      <section className={`${styles.manifestoSection} ${data.manifestoClass}`}>
        <span className={`${styles.manifestoTag} ${data.tagClass}`}>
          {data.manifestoTag}
        </span>
        <h2 className={`${styles.manifestoQuote} ${data.quoteClass}`}>
          {data.manifestoQuote}
        </h2>
        <p className={styles.manifestoBody}>
          {data.manifestoBody}
        </p>
      </section>

      {/* 2. Tier-Specific Protocol / Specifications Bento Grid */}
      <section>
        <div className={styles.sectionHeaderBlock}>
          <span className={styles.sectionSuperTag}>{data.protocolSuperTag}</span>
          <h3 className={styles.sectionMainTitle}>{data.protocolTitle}</h3>
        </div>

        <BentoGrid columns={3}>
          <BentoCard
            colSpan={2}
            badge="CORE SPECIFICATION"
            badgeType={tier === 1 ? 'coral' : 'mist'}
            title={data.protocols[0]?.title}
            description={data.protocols[0]?.desc}
            headerSlot={<span style={{ fontSize: '2.5rem' }}>{data.protocols[0]?.icon}</span>}
          />
          {data.protocols[1] && (
            <BentoCard
              colSpan={1}
              badge="LOGISTICS"
              badgeType="default"
              title={data.protocols[1].title}
              description={data.protocols[1].desc}
              headerSlot={<span style={{ fontSize: '2.5rem' }}>{data.protocols[1].icon}</span>}
            />
          )}
          {data.protocols[2] && (
            <BentoCard
              colSpan={1}
              badge="AUTHENTICITY"
              badgeType="default"
              title={data.protocols[2].title}
              description={data.protocols[2].desc}
              headerSlot={<span style={{ fontSize: '2.5rem' }}>{data.protocols[2].icon}</span>}
            />
          )}
          {data.protocols[3] && (
            <BentoCard
              colSpan={2}
              badge="DIRECT ACCESS"
              badgeType={tier === 1 ? 'coral' : 'mist'}
              title={data.protocols[3].title}
              description={data.protocols[3].desc}
              headerSlot={<span style={{ fontSize: '2.5rem' }}>{data.protocols[3].icon}</span>}
            />
          )}
        </BentoGrid>
      </section>

      {/* 3. Tier-Specific Capital Comparison Bento Grid */}
      <section>
        <div className={styles.sectionHeaderBlock}>
          <span className={styles.sectionSuperTag}>THE ABSURDITY INDEX</span>
          <h3 className={styles.sectionMainTitle}>{data.compTitle}</h3>
        </div>

        <BentoGrid columns={3}>
          <BentoCard
            colSpan={2}
            badge={`TIER ${tier} REALITY CHECK`}
            badgeType="coral"
            title={data.compTitle}
            description="What else could your capital command in the physical world? An uncompromising breakdown of vanity vs traditional luxury assets."
          >
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'var(--surface-2)', padding: '0.75rem 1.25rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>GERKINK UPKEEP</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.15rem', fontWeight: 800, color: '#3fb950' }}>$0.00 / YR</span>
              </div>
              <div style={{ background: 'var(--surface-2)', padding: '0.75rem 1.25rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>SUPERYACHT / JET DRAG</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent)' }}>$1,200,000+ / YR</span>
              </div>
            </div>
          </BentoCard>

          <BentoCard
            colSpan={1}
            badge="AUDACITY FACTOR"
            badgeType="mist"
            title="Irony & Provocation"
            description="Ordinary high-net-worth spending seeks social approval. Society Fu*kers spending is pure philosophical defiance."
          />

          <BentoCard
            colSpan="full"
            badge="FULL COMPARATIVE MATRIX"
            badgeType="default"
          >
            <div className={styles.comparisonContainer} style={{ padding: 0, background: 'transparent', border: 'none' }}>
              <table className={styles.compTable}>
                <thead>
                  <tr>
                    {data.compHeaders.map((header, idx) => (
                      <th key={idx}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.compRows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td>{row[0]}</td>
                      <td className={styles.tierHighlightCol}>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      {/* 4. Vault Allocation Live Status Registry Bento Grid */}
      <section>
        <div className={styles.sectionHeaderBlock}>
          <span className={styles.sectionSuperTag}>IMMUTABLE GLOBAL LEDGER</span>
          <h3 className={styles.sectionMainTitle}>{data.registryTitle}</h3>
        </div>

        <BentoGrid columns={3}>
          <BentoCard
            colSpan={1}
            badge="LIVE STOCK COUNTER"
            badgeType={tier === 1 ? 'coral' : 'default'}
            title={
              tier === 1 ? '🔥 ONLY 1 OF 1 LEFT' :
              tier === 2 ? '💎 ONLY 2 OF 2 LEFT' :
              tier === 3 ? '🔥 ONLY 5 OF 5 LEFT' :
              tier === 4 ? '⚡ ONLY 10 OF 10 LEFT' :
              '🛡️ 999 OF 999 LEFT'
            }
            description="Real-time global allocation quota ledger. Once these slots are claimed, no further pieces will ever be minted."
          >
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ background: 'var(--surface-2)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>REMAINING INVENTORY:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', fontWeight: 900, color: tier === 1 ? '#FFD700' : 'var(--accent)' }}>
                  {tier === 1 ? '1 / 1 LEFT' : tier === 2 ? '2 / 2 LEFT' : tier === 3 ? '5 / 5 LEFT' : tier === 4 ? '10 / 10 LEFT' : '999 / 999 LEFT'}
                </span>
              </div>
              {data.slots.map((slot, sIdx) => (
                <div key={sIdx} className={styles.slotCard}>
                  <span className={styles.slotNum}>{slot.label}</span>
                  <span className={styles.slotStatus}>{slot.status}</span>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard
            colSpan={2}
            badge="ESCROW & SECURITY"
            badgeType={tier === 1 ? 'coral' : 'mist'}
            title="Sovereign Allocation Protocol"
            description="Every Tier allocation includes direct escrow security, bespoke master pattern tailoring, and certified destruction of all master vector blueprint files upon delivery."
            href={`/contact?subject=VIP Concierge Request — Tier ${tier} (${product.title})`}
            ctaText="Speak with Private VIP Concierge Desk"
          />
        </BentoGrid>
      </section>

      {/* 5. Tier-Specific High-End FAQs */}
      <section>
        <div className={styles.sectionHeaderBlock}>
          <span className={styles.sectionSuperTag}>AUTHENTICATION &amp; LOGISTICS</span>
          <h3 className={styles.sectionMainTitle}>Tier {tier} Master Inquiries</h3>
        </div>

        <div className={styles.faqGrid}>
          {data.faqs.map((faq, fIdx) => (
            <div key={fIdx} className={styles.faqCard}>
              <button
                type="button"
                className={styles.faqBtn}
                onClick={() => toggleFaq(fIdx)}
              >
                <span>{faq.q}</span>
                <span className={styles.faqToggle}>{faqOpen[fIdx] ? '−' : '+'}</span>
              </button>
              {faqOpen[fIdx] && (
                <div className={styles.faqAnswer}>
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 6. Other Society Fuckers Tiers (Hierarchy Navigation) */}
      {recommendedProducts.length > 0 && (
        <section>
          <div className={styles.siblingsHeader}>
            <div>
              <span className={styles.sectionSuperTag}>THE SOCIETY FU*KERS COLLECTION</span>
              <h3 className={styles.sectionMainTitle}>Explore Other Luxury Tiers</h3>
            </div>
            <Link href="/shop/society-fuckers" className="btn btn-outline btn-sm">
              View Tier Pyramid ↗
            </Link>
          </div>

          <div className={styles.siblingsGrid}>
            {recommendedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
