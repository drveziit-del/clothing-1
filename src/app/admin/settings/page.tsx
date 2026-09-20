'use client';

import { useState, useEffect } from 'react';
import { TICKER_ROASTS } from '@/lib/utils/roasts';
import { useRoast } from '@/hooks/useRoast';
import { getFirestoreDb, getFirestoreModule } from '@/lib/firebase/config';
import styles from './page.module.css';
import adminStyles from '../page.module.css';

const DEFAULT_COPYWRITING = {
  heroLine1: 'YOU DRESS LIKE',
  heroLine2: 'YOUR PERSONALITY—',
  heroAccent: 'boring as f*ck.',
  heroSubtext: 'Fix it. Or don\'t. We don\'t care.\nBut you should.',
  heroCta: 'PROVE ME WRONG →',
  manifestoHeroPull: 'Fashion is a mirror. Ours tells the truth.',
  manifestoCtaText: "You read the whole thing. Either you're genuinely curious or you're procrastinating fixing your wardrobe. Either way —",
  manifestoCtaButton: 'Stop Procrastinating →',
  manifestoSections: [
    {
      label: 'Origin',
      title: "Fashion didn't die. It got boring.",
      body: "Every brand wants to inspire you. Every campaign wants to uplift, empower, celebrate you. What a pathetic lie. You don't need inspiration. You need a mirror that tells the truth. That's what GERKINK is: the mirror your wardrobe was too afraid to be."
    },
    {
      label: 'Philosophy',
      title: 'We roast you because we respect you.',
      body: "Your best friend doesn't sugarcoat. They tell you that shirt makes you look like you work at a middle school. They tell you that you've been wearing the same style since 2018. That's love. That's GERKINK. We're not here to validate your mediocrity — we're here to end it."
    },
    {
      label: 'The Collections',
      title: 'Two worlds. No in-between.',
      body: "Society Fu*kers is for the delusional rich — people who have run out of meaningful ways to spend money and have arrived, finally, at a t-shirt that costs more than a small country's GDP. Valueless Bi*ches is for everyone else who knows their worth even when the price tag doesn't reflect it yet."
    },
    {
      label: 'The Owners',
      title: 'We are nobody.',
      body: "Our names are not on the label. Our faces are not on the campaign. Our egos are not attached to the outcome. We created GERKINK because the fashion industry needed a brand that doesn't pretend. The clothes speak. We don't need to."
    },
    {
      label: 'The Promise',
      title: 'You will be roasted. You will be better for it.',
      body: "Every interaction with GERKINK — from the homepage that calls you boring to the checkout confirmation that says \"finally\" — is designed to make you slightly uncomfortable. That discomfort is intentional. That discomfort is the point. Comfort is the enemy of style."
    }
  ],
  ownersTitle: 'We are\nnobody.',
  ownersDesc: 'Our names are not important. Our clothes are.\nEverything you need to know about us is already on your back.',
  ownersQuote: 'The brand is the work. The work speaks. We don’t need to.',
  ownersAttribution: '— GERKINK Owners, in the only interview they’ve ever agreed to',
  ownersList: [
    {
      alias: 'THE ARCHITECT',
      role: 'Design + Vision',
      bio: 'Designed the brand. Refuses to be photographed. Allegedly has 14 t-shirts — all black. May or may not be a former hedge fund manager who had a spiritual crisis.'
    },
    {
      alias: 'THE OPERATOR',
      role: 'Operations + Strategy',
      bio: 'Runs everything. Known only by initials. Has been described as "frighteningly competent" and "the kind of person who reads terms of service." Probably enjoys this.'
    }
  ],
  footerTagline: 'We are nobody.\nOur clothes speak louder.'
};

const DEFAULT_BANK_DETAILS = {
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  routingNumber: '',
  swiftBic: '',
  bankCountry: 'United States',
  currency: 'USD',
  wiseEmail: '',
  wiseTag: '',
  referenceInstructions: '',
  supportNotice: '',
};

type Tab = 'roasts' | 'copywriting' | 'bank';

export default function AdminSettingsPage() {
  const { toast } = useRoast();
  const [activeTab, setActiveTab] = useState<Tab>('roasts');
  const [roastMessages, setRoastMessages] = useState<string[]>(TICKER_ROASTS);
  const [newRoast, setNewRoast] = useState('');
  const [savingRoasts, setSavingRoasts] = useState(false);

  // Announcement Bar dynamic controls
  const [announcementGiantText, setAnnouncementGiantText] = useState('LOOK AT ME FOLKS');
  const [announcementCapsuleTag, setAnnouncementCapsuleTag] = useState('LOOK AT ME FOLKS');
  const [announcementCapsuleMessage, setAnnouncementCapsuleMessage] = useState('NEW DROP JUST LANDED');
  const [announcementCapsuleLink, setAnnouncementCapsuleLink] = useState('/shop');
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);

  // Shipping config state
  const [standardShippingFee, setStandardShippingFee] = useState(15);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(100);

  // Copywriting states
  const [copywriting, setCopywriting] = useState(DEFAULT_COPYWRITING);
  const [savingCopy, setSavingCopy] = useState(false);

  // Bank & Wise state
  const [bankDetails, setBankDetails] = useState(DEFAULT_BANK_DETAILS);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [bankLoadError, setBankLoadError] = useState<string | null>(null);
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    // Dynamic fetch settings
    const { doc, getDoc } = getFirestoreModule();
    const db = getFirestoreDb();

    async function loadData() {
      try {
        const roastSnap = await getDoc(doc(db, 'settings', 'global'));
        if (roastSnap.exists()) {
          const data = roastSnap.data();
          if (data.announcementMessages && Array.isArray(data.announcementMessages)) {
            setRoastMessages(data.announcementMessages);
          } else if (data.roastMessages && Array.isArray(data.roastMessages)) {
            setRoastMessages(data.roastMessages);
          }
          if (typeof data.announcementGiantText === 'string') setAnnouncementGiantText(data.announcementGiantText);
          if (typeof data.announcementCapsuleTag === 'string') setAnnouncementCapsuleTag(data.announcementCapsuleTag);
          if (typeof data.announcementCapsuleMessage === 'string') setAnnouncementCapsuleMessage(data.announcementCapsuleMessage);
          if (typeof data.announcementCapsuleLink === 'string') setAnnouncementCapsuleLink(data.announcementCapsuleLink);
          if (typeof data.announcementEnabled === 'boolean') setAnnouncementEnabled(data.announcementEnabled);
          if (typeof data.standardShippingFee === 'number') setStandardShippingFee(data.standardShippingFee);
          if (typeof data.freeShippingThreshold === 'number') setFreeShippingThreshold(data.freeShippingThreshold);
        }

        const copySnap = await getDoc(doc(db, 'settings', 'copywriting'));
        if (copySnap.exists()) {
          setCopywriting(prev => ({ ...prev, ...copySnap.data() }));
        }

        // Bank details are AES-256-GCM encrypted at rest by the admin API;
        // this endpoint returns them decrypted for editing.
        try {
          const bankRes = await fetch('/api/settings/bank-details');
          if (!bankRes.ok) {
            throw new Error(`Failed to load bank details (HTTP ${bankRes.status})`);
          }
          const bankData = await bankRes.json();
          setBankDetails(prev => ({ ...prev, ...bankData }));
          setBankLoaded(true);
          setBankLoadError(null);
        } catch (bankErr: any) {
          console.error('Failed to load decrypted bank details:', bankErr);
          setBankLoaded(false);
          setBankLoadError(bankErr?.message || 'Failed to load bank details from server');
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    }
    loadData();
  }, []);

  const addRoast = () => {
    if (!newRoast.trim()) return;
    setRoastMessages((prev) => [...prev, newRoast.trim()]);
    setNewRoast('');
  };

  const removeRoast = (i: number) => {
    setRoastMessages((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSaveRoasts = async () => {
    setSavingRoasts(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roastMessages,
          announcementMessages: roastMessages,
          announcementGiantText,
          announcementCapsuleTag,
          announcementCapsuleMessage,
          announcementCapsuleLink,
          announcementEnabled,
          standardShippingFee,
          freeShippingThreshold,
        }),
      });
      if (!res.ok) throw new Error();
      toast('Announcements & Ticker saved. Live site updated.', 'success');
    } catch {
      toast('Save failed. Even the settings page judges you.', 'error');
    } finally {
      setSavingRoasts(false);
    }
  };

  const handleSaveCopywriting = async () => {
    setSavingCopy(true);
    try {
      const res = await fetch('/api/admin/copywriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copywriting),
      });
      if (!res.ok) throw new Error();
      toast('Site copywriting saved successfully.', 'success');
    } catch {
      toast('Save failed. Even the server dislikes your content.', 'error');
    } finally {
      setSavingCopy(false);
    }
  };

  const handleSaveBankDetails = async () => {
    if (!bankLoaded || savingBank) return;
    setSavingBank(true);
    try {
      const res = await fetch('/api/admin/settings/bank-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankDetails),
      });
      if (!res.ok) throw new Error();
      toast('Wise & Bank transfer details saved successfully.', 'success');
    } catch {
      toast('Failed to save bank details.', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  // Manifesto list operations
  const updateManifestoSection = (index: number, field: string, value: string) => {
    setCopywriting(prev => {
      const list = [...prev.manifestoSections];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, manifestoSections: list };
    });
  };

  const addManifestoSection = () => {
    setCopywriting(prev => ({
      ...prev,
      manifestoSections: [...prev.manifestoSections, { label: 'New Tag', title: 'New Section Title', body: 'New Section body text...' }]
    }));
  };

  const removeManifestoSection = (index: number) => {
    setCopywriting(prev => ({
      ...prev,
      manifestoSections: prev.manifestoSections.filter((_, idx) => idx !== index)
    }));
  };

  // Owners list operations
  const updateOwner = (index: number, field: string, value: string) => {
    setCopywriting(prev => {
      const list = [...prev.ownersList];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, ownersList: list };
    });
  };

  const addOwner = () => {
    setCopywriting(prev => ({
      ...prev,
      ownersList: [...prev.ownersList, { alias: 'THE SPECTRE', role: 'Ghost in the Machine', bio: 'Biography...' }]
    }));
  };

  const removeOwner = (index: number) => {
    setCopywriting(prev => ({
      ...prev,
      ownersList: prev.ownersList.filter((_, idx) => idx !== index)
    }));
  };

  return (
    <div className={adminStyles.page}>
      <div className={adminStyles.header}>
        <h1 className={adminStyles.title}>Settings</h1>
        <p className={adminStyles.subtitle}>Configure roasts and customize global website text copy.</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          onClick={() => setActiveTab('roasts')}
          className={`${styles.tabBtn} ${activeTab === 'roasts' ? styles.tabActive : ''}`}
        >
          📢 Announcements &amp; Ticker
        </button>
        <button
          onClick={() => setActiveTab('copywriting')}
          className={`${styles.tabBtn} ${activeTab === 'copywriting' ? styles.tabActive : ''}`}
        >
          Site Copywriting
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={`${styles.tabBtn} ${activeTab === 'bank' ? styles.tabActive : ''}`}
        >
          🏦 Wise &amp; Bank Treasury
        </button>
      </div>

      {activeTab === 'roasts' && (
        <section className={adminStyles.section}>
          <h2 className={adminStyles.sectionTitle}>Announcement &amp; Ticker Messages</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            These messages continuously scroll horizontally in the coral pink announcement bar directly under the navbar and across site tickers in real time.
          </p>

          {/* Quick preset templates */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}
              onClick={() => setRoastMessages(prev => [...prev, '✦ LIMITED DROP: PEASANT PREMIUM 2.0 CAPSULE IS LIVE'])}
            >
              + Drop Notice
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}
              onClick={() => setRoastMessages(prev => [...prev, '✦ RESTOCK: ALL HOODIE SIZES [S–3XL] NOW IN STOCK'])}
            >
              + Restock Alert
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}
              onClick={() => setRoastMessages(prev => [...prev, '✦ SHIPPING: WORLDWIDE 21-DAY CUSTOM PRINTED DISPATCH'])}
            >
              + Shipping Notice
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}
              onClick={() => setRoastMessages(prev => [...prev, '✦ REFERRAL REWARDS: EARN $100 CASH PER 10 CLIENT PURCHASES'])}
            >
              + Referral Milestone
            </button>
          </div>

          <div className={styles.roastList}>
            {roastMessages.map((msg, i) => (
              <div key={i} className={styles.roastItem}>
                <input
                  type="text"
                  className={styles.roastInput}
                  value={msg}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRoastMessages((prev) => {
                      const next = [...prev];
                      next[i] = val;
                      return next;
                    });
                  }}
                  maxLength={300}
                  placeholder="Announcement or roast message"
                />
                <button onClick={() => removeRoast(i)} className={styles.removeBtn} aria-label="Remove message">×</button>
              </div>
            ))}
          </div>

          <div className={styles.addRoast}>
            <input
              type="text"
              className="input"
              placeholder="Add custom announcement text (e.g. ✦ FLASH RESTOCK ✦ 240GSM TEES LIVE)"
              value={newRoast}
              onChange={(e) => setNewRoast(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRoast()}
              maxLength={300}
            />
            <button onClick={addRoast} className="btn btn-secondary btn-sm">Add</button>
          </div>

          <div className={styles.dividerLine} />

          {/* ── Liquid Glass & Header Configuration ── */}
          <h2 className={adminStyles.sectionTitle} style={{ marginTop: '1.5rem' }}>Liquid Glass &amp; Typography Settings</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Customize the background oversized text and the centered translucent Liquid Glass button.
          </p>

          <div className={styles.inputRow} style={{ marginBottom: '1rem' }}>
            <div>
              <label className="input-label">Background Giant Text (Coral Pink)</label>
              <input
                type="text"
                className="input"
                value={announcementGiantText}
                onChange={(e) => setAnnouncementGiantText(e.target.value)}
                placeholder="e.g. LOOK AT ME FOLKS"
                maxLength={100}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                Oversized background text layer that appears behind the moving marquee.
              </span>
            </div>
            <div>
              <label className="input-label">Liquid Glass Pill Tag</label>
              <input
                type="text"
                className="input"
                value={announcementCapsuleTag}
                onChange={(e) => setAnnouncementCapsuleTag(e.target.value)}
                placeholder="e.g. LOOK AT ME FOLKS or ALERT"
                maxLength={50}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                The category/status tag shown inside the glass capsule pill.
              </span>
            </div>
          </div>

          <div className={styles.inputRow}>
            <div>
              <label className="input-label">Liquid Glass Message</label>
              <input
                type="text"
                className="input"
                value={announcementCapsuleMessage}
                onChange={(e) => setAnnouncementCapsuleMessage(e.target.value)}
                placeholder="e.g. NEW DROP JUST LANDED"
                maxLength={100}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                Headline text shown inside the centered button.
              </span>
            </div>
            <div>
              <label className="input-label">Liquid Glass Destination Link</label>
              <input
                type="text"
                className="input"
                value={announcementCapsuleLink}
                onChange={(e) => setAnnouncementCapsuleLink(e.target.value)}
                placeholder="e.g. /shop or /shop/valueless-bitches"
                maxLength={200}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                Where the user navigates when clicking the capsule button.
              </span>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <input
              type="checkbox"
              id="announcementEnabled"
              checked={announcementEnabled}
              onChange={(e) => setAnnouncementEnabled(e.target.checked)}
              style={{ accentColor: 'var(--coral-200)', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="announcementEnabled" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
              Show Announcement Bar on Website
            </label>
          </div>

          <div className={styles.dividerLine} />

          <h2 className={adminStyles.sectionTitle} style={{ marginTop: '1.5rem' }}>Shipping Configuration</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Control the standard shipping fee and the subtotal threshold for free shipping.
          </p>

          <div className={styles.inputRow}>
            <div>
              <label className="input-label">Standard Shipping Fee (USD)</label>
              <input
                type="number"
                className="input"
                min={0}
                step={0.01}
                value={standardShippingFee}
                onChange={(e) => setStandardShippingFee(Number(e.target.value))}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                Charged when order subtotal is below the free shipping threshold.
              </span>
            </div>
            <div>
              <label className="input-label">Free Shipping Threshold (USD)</label>
              <input
                type="number"
                className="input"
                min={0}
                step={0.01}
                value={freeShippingThreshold}
                onChange={(e) => setFreeShippingThreshold(Number(e.target.value))}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                Orders at or above this subtotal get free shipping.
              </span>
            </div>
          </div>

          <button onClick={handleSaveRoasts} disabled={savingRoasts} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
            {savingRoasts ? 'Saving...' : 'Save Settings'}
          </button>
        </section>
      )}

      {activeTab === 'copywriting' && (
        <section className={adminStyles.section}>
          <h2 className={adminStyles.sectionTitle}>Homepage Copywriting</h2>
          <div className={styles.formGroup}>
            <div className={styles.inputRow}>
              <div>
                <label className="input-label">Headline Line 1</label>
                <input
                  type="text"
                  className="input"
                  value={copywriting.heroLine1}
                  onChange={(e) => setCopywriting(prev => ({ ...prev, heroLine1: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Headline Line 2</label>
                <input
                  type="text"
                  className="input"
                  value={copywriting.heroLine2}
                  onChange={(e) => setCopywriting(prev => ({ ...prev, heroLine2: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="input-label">Headline Accent Color (e.g. "boring as f*ck.")</label>
              <input
                type="text"
                className="input"
                value={copywriting.heroAccent}
                onChange={(e) => setCopywriting(prev => ({ ...prev, heroAccent: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">Hero Description Subtext</label>
              <textarea
                className="input"
                style={{ minHeight: '80px', fontFamily: 'inherit' }}
                value={copywriting.heroSubtext}
                onChange={(e) => setCopywriting(prev => ({ ...prev, heroSubtext: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">Hero CTA Button Text</label>
              <input
                type="text"
                className="input"
                value={copywriting.heroCta}
                onChange={(e) => setCopywriting(prev => ({ ...prev, heroCta: e.target.value }))}
              />
            </div>
          </div>

          <h2 className={adminStyles.sectionTitle} style={{ marginTop: '2.5rem' }}>Manifesto Copywriting</h2>
          <div className={styles.formGroup}>
            <div>
              <label className="input-label">Manifesto Hero Pullquote</label>
              <input
                type="text"
                className="input"
                value={copywriting.manifestoHeroPull}
                onChange={(e) => setCopywriting(prev => ({ ...prev, manifestoHeroPull: e.target.value }))}
              />
            </div>

            <div className={styles.manifestoListSection}>
              <span className={styles.sectionSubLabel}>Manifesto Grid Sections</span>
              {copywriting.manifestoSections.map((sec, idx) => (
                <div key={idx} className={styles.nestedCard}>
                  <div className={styles.nestedCardHeader}>
                    <span className={styles.nestedTitle}>Section #{idx + 1} ({sec.label})</span>
                    <button onClick={() => removeManifestoSection(idx)} className={styles.deleteNestedBtn}>Remove</button>
                  </div>
                  <div className={styles.inputRow}>
                    <div>
                      <label className="input-label">Section Tag Label</label>
                      <input
                        type="text"
                        className="input"
                        value={sec.label}
                        onChange={(e) => updateManifestoSection(idx, 'label', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="input-label">Section Heading Title</label>
                      <input
                        type="text"
                        className="input"
                        value={sec.title}
                        onChange={(e) => updateManifestoSection(idx, 'title', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Section Body Description</label>
                    <textarea
                      className="input"
                      style={{ minHeight: '80px', fontFamily: 'inherit' }}
                      value={sec.body}
                      onChange={(e) => updateManifestoSection(idx, 'body', e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <button onClick={addManifestoSection} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                + Add Manifesto Section
              </button>
            </div>

            <div className={styles.inputRow}>
              <div>
                <label className="input-label">CTA Bottom Text</label>
                <input
                  type="text"
                  className="input"
                  value={copywriting.manifestoCtaText}
                  onChange={(e) => setCopywriting(prev => ({ ...prev, manifestoCtaText: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">CTA Button Text</label>
                <input
                  type="text"
                  className="input"
                  value={copywriting.manifestoCtaButton}
                  onChange={(e) => setCopywriting(prev => ({ ...prev, manifestoCtaButton: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <h2 className={adminStyles.sectionTitle} style={{ marginTop: '2.5rem' }}>Owners Copywriting</h2>
          <div className={styles.formGroup}>
            <div className={styles.inputRow}>
              <div>
                <label className="input-label">Hero Title (use \n for line breaks)</label>
                <textarea
                  className="input"
                  style={{ minHeight: '60px', fontFamily: 'inherit' }}
                  value={copywriting.ownersTitle}
                  onChange={(e) => setCopywriting(prev => ({ ...prev, ownersTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Hero Description (use \n for line breaks)</label>
                <textarea
                  className="input"
                  style={{ minHeight: '60px', fontFamily: 'inherit' }}
                  value={copywriting.ownersDesc}
                  onChange={(e) => setCopywriting(prev => ({ ...prev, ownersDesc: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="input-label">Bottom Quote</label>
              <input
                type="text"
                className="input"
                value={copywriting.ownersQuote}
                onChange={(e) => setCopywriting(prev => ({ ...prev, ownersQuote: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">Quote Attribution</label>
              <input
                type="text"
                className="input"
                value={copywriting.ownersAttribution}
                onChange={(e) => setCopywriting(prev => ({ ...prev, ownersAttribution: e.target.value }))}
              />
            </div>

            <div className={styles.manifestoListSection}>
              <span className={styles.sectionSubLabel}>Owners List Profiles</span>
              {copywriting.ownersList.map((owner, idx) => (
                <div key={idx} className={styles.nestedCard}>
                  <div className={styles.nestedCardHeader}>
                    <span className={styles.nestedTitle}>Profile #{idx + 1} ({owner.alias})</span>
                    <button onClick={() => removeOwner(idx)} className={styles.deleteNestedBtn}>Remove</button>
                  </div>
                  <div className={styles.inputRow}>
                    <div>
                      <label className="input-label">Alias Name</label>
                      <input
                        type="text"
                        className="input"
                        value={owner.alias}
                        onChange={(e) => updateOwner(idx, 'alias', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="input-label">Vision Role Title</label>
                      <input
                        type="text"
                        className="input"
                        value={owner.role}
                        onChange={(e) => updateOwner(idx, 'role', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Biography Description</label>
                    <textarea
                      className="input"
                      style={{ minHeight: '80px', fontFamily: 'inherit' }}
                      value={owner.bio}
                      onChange={(e) => updateOwner(idx, 'bio', e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <button onClick={addOwner} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                + Add Owner Profile
              </button>
            </div>
          </div>

          <h2 className={adminStyles.sectionTitle} style={{ marginTop: '2.5rem' }}>Footer Copywriting</h2>
          <div className={styles.formGroup}>
            <div>
              <label className="input-label">Footer Tagline (use \n for line breaks)</label>
              <textarea
                className="input"
                style={{ minHeight: '60px', fontFamily: 'inherit' }}
                value={copywriting.footerTagline}
                onChange={(e) => setCopywriting(prev => ({ ...prev, footerTagline: e.target.value }))}
              />
            </div>
          </div>

          <button onClick={handleSaveCopywriting} disabled={savingCopy} className="btn btn-primary" style={{ marginTop: '2rem' }}>
            {savingCopy ? 'Saving Copy...' : 'Save Copywriting'}
          </button>
        </section>
      )}

      {activeTab === 'bank' && (
        <section className={adminStyles.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 className={adminStyles.sectionTitle}>Wise &amp; Bank Wire Treasury Details</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                These bank account credentials and wire routing instructions are displayed to clients during Luxury Pre-booking checkout.
              </p>
            </div>
            <button
              onClick={handleSaveBankDetails}
              disabled={savingBank || !bankLoaded}
              className="btn btn-primary"
            >
              {savingBank ? 'Saving Treasury Details...' : !bankLoaded ? 'Treasury Details Unavailable' : 'Save Treasury Details'}
            </button>
          </div>

          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {!bankLoaded && (
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: '6px', color: '#ff6b6b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚠️</span>
                <span>{bankLoadError ? `Error: ${bankLoadError}. Editing and saving are disabled to protect encrypted treasury credentials.` : 'Loading decrypted treasury details from server... Saving is disabled until valid load completes.'}</span>
              </div>
            )}

            <fieldset disabled={!bankLoaded || savingBank} style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className={styles.inputRow}>
              <div>
                <label className="input-label">Bank Name &amp; Entity</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Wise Payments Ltd / JPMorgan Chase Bank, N.A."
                  value={bankDetails.bankName}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Account Holder Legal Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. GERKINK GLOBAL ENTERPRISES LLC"
                  value={bankDetails.accountHolder}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, accountHolder: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.inputRow}>
              <div>
                <label className="input-label">Account Number / IBAN</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 9876543210 or GB33WISE..."
                  value={bankDetails.accountNumber}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Routing / ABA / Sort Code</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 026073150"
                  value={bankDetails.routingNumber || ''}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, routingNumber: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.inputRow}>
              <div>
                <label className="input-label">SWIFT / BIC Code</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. WISEUS33XXX"
                  value={bankDetails.swiftBic || ''}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, swiftBic: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Bank Country &amp; Settlement Currency</label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. United States"
                    value={bankDetails.bankCountry}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, bankCountry: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="USD"
                    value={bankDetails.currency}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>
            </div>

            <div className={styles.inputRow}>
              <div>
                <label className="input-label">Wise Treasury Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="e.g. treasury@gerkink.shop"
                  value={bankDetails.wiseEmail || ''}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, wiseEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Wise Pay Tag / Handle</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. @gerkink-treasury"
                  value={bankDetails.wiseTag || ''}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, wiseTag: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="input-label">Wire Reference Memo Instructions (Client Prompt)</label>
              <textarea
                className="input"
                style={{ minHeight: '70px', fontFamily: 'inherit' }}
                placeholder="e.g. Please include your Allocation Order ID (e.g. PREBOOK-XXXXXX) in the wire reference or memo."
                value={bankDetails.referenceInstructions || ''}
                onChange={(e) => setBankDetails(prev => ({ ...prev, referenceInstructions: e.target.value }))}
              />
            </div>

            <div>
              <label className="input-label">Treasury Verification &amp; Support Notice</label>
              <textarea
                className="input"
                style={{ minHeight: '60px', fontFamily: 'inherit' }}
                placeholder="e.g. Wire transfers and Wise payments are audited and confirmed by our treasury desk within 2 to 6 hours."
                value={bankDetails.supportNotice || ''}
                onChange={(e) => setBankDetails(prev => ({ ...prev, supportNotice: e.target.value }))}
              />
            </div>
            </fieldset>

            <button
              onClick={handleSaveBankDetails}
              disabled={savingBank || !bankLoaded}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
            >
              {savingBank ? 'Saving Treasury Details...' : !bankLoaded ? 'Treasury Details Unavailable' : 'Save Treasury Details'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
