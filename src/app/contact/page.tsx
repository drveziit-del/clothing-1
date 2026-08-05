'use client';

import { useState } from 'react';
import { contactSchema } from '@/lib/utils/validation';
import { useRoast } from '@/hooks/useRoast';
import styles from './page.module.css';

export default function ContactPage() {
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
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
              <a href="https://www.instagram.com/gerkink.shop" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Instagram (@gerkink.shop) →
              </a>
              <a href="https://x.com/gerkinkshop" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Twitter / X (@gerkinkshop) →
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
