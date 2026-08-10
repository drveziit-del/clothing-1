'use client';

import { useState } from 'react';
import { contactSchema } from '@/lib/utils/validation';
import { useRoast } from '@/hooks/useRoast';
import styles from './page.module.css';

export default function ContactClient() {
  const { toast } = useRoast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const raw = {
      name:    fd.get('name') as string,
      email:   fd.get('email') as string,
      message: fd.get('message') as string,
    };

    const result = contactSchema.safeParse(raw);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });
      if (!res.ok) throw new Error();
      setSent(true);
      toast('Message received. We\'ll roast you back shortly.', 'success');
    } catch {
      toast('Message failed. Unlike your excuses, this can be fixed.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>Reach out</span>
          <h1 className={styles.title}>Contact</h1>
          <p className={styles.desc}>
            Questions about your order? Complaints about our attitude? 
            Want to collaborate? We might respond. No promises.
          </p>
          <div className={styles.channels}>
            <span className={styles.channelNote}>
              We don&apos;t do phone calls. We barely do emails. 
              But we read everything.
            </span>
            <div className={styles.emailContainer}>
              <span className={styles.emailTagline}>Or scream into the void:</span>
              <a href="mailto:gerkinkofficial@gmail.com" className={styles.emailLink}>
                gerkinkofficial@gmail.com
              </a>
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Socials:</span>
              <a href="https://www.instagram.com/gerkink.shop" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }} title="Instagram (@gerkink.shop)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>
              <a href="https://x.com/gerkinkshop" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }} title="Twitter / X (@gerkinkshop)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://www.reddit.com/u/gerkinkshop/s/BvlrtcmSGK" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }} title="Reddit (u/gerkinkshop)">
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6.167 8a.83.83 0 0 0-.83.83c0 .459.372.84.83.831a.831.831 0 0 0 0-1.661m1.843 3.647c.315 0 1.403-.038 1.976-.611a.23.23 0 0 0 0-.306.213.213 0 0 0-.306 0c-.353.363-1.126.487-1.67.487-.545 0-1.308-.124-1.671-.487a.213.213 0 0 0-.306 0 .213.213 0 0 0 0 .306c.564.563 1.652.61 1.977.61zm.992-2.807c0 .458.373.83.831.83s.83-.381.83-.83a.831.831 0 0 0-1.66 0z"/>
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.828-1.165c-.315 0-.602.124-.812.325-.801-.573-1.9-.945-3.121-.993l.534-2.501 1.738.372a.83.83 0 1 0 .83-.869.83.83 0 0 0-.744.468l-1.938-.41a.2.2 0 0 0-.153.028.2.2 0 0 0-.086.134l-.592 2.788c-1.24.038-2.358.41-3.17.992-.21-.2-.496-.324-.81-.324a1.163 1.163 0 0 0-.478 2.224q-.03.17-.029.353c0 1.795 2.091 3.256 4.669 3.256s4.668-1.451 4.668-3.256c0-.114-.01-.238-.029-.353.401-.181.688-.592.688-1.069 0-.65-.525-1.165-1.165-1.165"/>
                </svg>
              </a>
              <a href="https://discord.gg/549V3MMy7" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }} title="Discord (Join Server)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          {sent ? (
            <div className={styles.success}>
              <span className={styles.successIcon}>✦</span>
              <h2 className={styles.successTitle}>Message received.</h2>
              <p className={styles.successDesc}>
                We read it. We judged it. We&apos;ll respond when we feel like it — 
                which is usually within 2-3 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className={styles.form}>
              <div>
                <label htmlFor="name" className="input-label">Name</label>
                <input id="name" name="name" type="text" className="input"
                   placeholder="What people call you (not what you call yourself)" />
                {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
              </div>

              <div>
                <label htmlFor="email" className="input-label">Email</label>
                <input id="email" name="email" type="email" className="input"
                   placeholder="A real one. We don't spam." />
                {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
              </div>

              <div>
                <label htmlFor="message" className="input-label">Message</label>
                <textarea id="message" name="message" className={`input ${styles.textarea}`}
                   placeholder="Say what you actually mean. We can handle it."
                   rows={5} />
                {errors.message && <span className={styles.fieldError}>{errors.message}</span>}
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
