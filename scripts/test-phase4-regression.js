/**
 * GERKINK Phase 4 Regression Test Suite
 * Tests all 5 "READY TO IMPLEMENT" remediations:
 * 1. Primary CTA Color Contrast (WCAG 1.4.3)
 * 2. Accessible Skip-to-Content Link (WCAG 2.4.1)
 * 3. Modal Focus Confinement & Escape Handler (WCAG 2.4.3)
 * 4. Checkout Form Error Association (WCAG 1.3.1 / 3.3.1)
 * 5. Mobile Sticky Bar Active-Size Indicator & Selection Guard
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

console.log('====================================================');
console.log('    GERKINK PHASE 4 REGRESSION VERIFICATION SUITE   ');
console.log('====================================================\n');

// ── 1. PRIMARY CTA COLOR CONTRAST (WCAG 1.4.3) ───────────────────
console.log('--- 1. Testing Primary Button Contrast ---');

function getLuminance(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test('1.1 Contrast of #07090E on #FF6B6B exceeds WCAG AA (4.5:1) and AAA (7.0:1)', () => {
  const fg = '#07090E';
  const bg = '#FF6B6B';
  const ratio = getContrastRatio(fg, bg);
  assert(ratio >= 7.0, `Expected ratio >= 7.0 (AAA), got ${ratio.toFixed(2)}:1`);
  console.log(`      Verified mathematically: ${ratio.toFixed(2)}:1 contrast ratio`);
});

test('1.2 Contrast on hover state (#07090E on #E85555) exceeds WCAG AA (4.5:1)', () => {
  const fg = '#07090E';
  const bg = '#E85555';
  const ratio = getContrastRatio(fg, bg);
  assert(ratio >= 4.5, `Expected ratio >= 4.5 (AA), got ${ratio.toFixed(2)}:1`);
  console.log(`      Verified hover ratio: ${ratio.toFixed(2)}:1 contrast ratio`);
});

test('1.3 globals.css applies dark text #07090E to .btn-primary', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'src/app/globals.css'), 'utf8');
  assert(css.includes('.btn-primary  { background: var(--accent); color: #07090E; }'), 'globals.css missing dark text for .btn-primary');
  assert(css.includes('.btn-primary:hover {\n  background: var(--coral-300);\n  color: #07090E;'), 'globals.css missing dark text on hover');
});

// ── 2. ACCESSIBLE SKIP LINK (WCAG 2.4.1) ──────────────────────────
console.log('\n--- 2. Testing Accessible Skip Link ---');

test('2.1 LayoutWrapper renders skip link anchor as first interactive child', () => {
  const layout = fs.readFileSync(path.join(ROOT_DIR, 'src/components/layout/LayoutWrapper.tsx'), 'utf8');
  assert(layout.includes('<a href="#main-content" className="skip-link">'), 'Skip link anchor missing in LayoutWrapper');
  assert(layout.indexOf('skip-link') < layout.indexOf('<Navbar'), 'Skip link must precede Navbar in DOM');
});

test('2.2 Main content element has stable id and tabIndex={-1}', () => {
  const layout = fs.readFileSync(path.join(ROOT_DIR, 'src/components/layout/LayoutWrapper.tsx'), 'utf8');
  assert(layout.includes('<main id="main-content" className="site-main" tabIndex={-1}>'), 'Main landmark missing id or tabIndex={-1}');
});

test('2.3 globals.css hides skip link off-screen until focused', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'src/app/globals.css'), 'utf8');
  assert(css.includes('.skip-link {'), 'Missing .skip-link in globals.css');
  assert(css.includes('top: -120px;'), 'Missing off-screen position for .skip-link');
  assert(css.includes('.skip-link:focus {'), 'Missing .skip-link:focus in globals.css');
  assert(css.includes('top: 1.5rem;'), 'Missing on-screen position for .skip-link:focus');
});

// ── 3. MODAL FOCUS CONFINEMENT & RESTORATION (WCAG 2.4.3) ─────────
console.log('\n--- 3. Testing Modal Focus Confinement & Restoration ---');

test('3.1 useFocusTrap hook exists and implements complete trap logic', () => {
  const hook = fs.readFileSync(path.join(ROOT_DIR, 'src/lib/utils/useFocusTrap.ts'), 'utf8');
  assert(hook.includes('FOCUSABLE_SELECTOR'), 'Missing FOCUSABLE_SELECTOR');
  assert(hook.includes('previousFocusRef'), 'Missing previousFocusRef for focus restoration');
  assert(hook.includes("e.key === 'Escape'"), 'Missing Escape key handling');
  assert(hook.includes("e.key === 'Tab'"), 'Missing Tab key trapping');
  assert(hook.includes('e.shiftKey'), 'Missing Shift+Tab reverse cycle handling');
  assert(hook.includes('previousFocusRef.current.focus()'), 'Missing focus restoration on close');
});

test('3.2 Modal.tsx utilizes useFocusTrap', () => {
  const modal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/ui/Modal.tsx'), 'utf8');
  assert(modal.includes("import { useFocusTrap } from '@/lib/utils/useFocusTrap'"), 'Modal.tsx does not import useFocusTrap');
  assert(modal.includes('const overlayRef = useFocusTrap<HTMLDivElement>(open, onClose)'), 'Modal.tsx does not wire useFocusTrap');
});

test('3.3 WriteReviewModal.tsx utilizes useFocusTrap', () => {
  const reviewModal = fs.readFileSync(path.join(ROOT_DIR, 'src/components/reviews/WriteReviewModal.tsx'), 'utf8');
  assert(reviewModal.includes("import { useFocusTrap } from '@/lib/utils/useFocusTrap'"), 'WriteReviewModal.tsx does not import useFocusTrap');
  assert(reviewModal.includes('const modalOverlayRef = useFocusTrap<HTMLDivElement>(isOpen, onClose)'), 'WriteReviewModal.tsx does not wire useFocusTrap');
  assert(reviewModal.includes('ref={modalOverlayRef}'), 'WriteReviewModal.tsx does not bind ref');
  assert(reviewModal.includes('id="review-modal-title"'), 'WriteReviewModal.tsx title missing accessible id');
});

// ── 4. CHECKOUT FORM ERROR ACCESSIBILITY (WCAG 1.3.1 / 3.3.1) ─────
console.log('\n--- 4. Testing Checkout Form Error Accessibility ---');

test('4.1 Address inputs in checkout/page.tsx bind aria-invalid and aria-describedby', () => {
  const checkout = fs.readFileSync(path.join(ROOT_DIR, 'src/app/checkout/page.tsx'), 'utf8');
  assert(checkout.includes("aria-invalid={errors[field.id] ? 'true' : 'false'}"), 'Missing aria-invalid on address inputs');
  assert(checkout.includes("aria-describedby={errors[field.id] ? `${field.id}-error` : undefined}"), 'Missing aria-describedby on address inputs');
  assert(checkout.includes('id={`${field.id}-error`} role="alert"'), 'Missing id or role="alert" on address error messages');
});

test('4.2 Country select in checkout/page.tsx binds aria-invalid and aria-describedby', () => {
  const checkout = fs.readFileSync(path.join(ROOT_DIR, 'src/app/checkout/page.tsx'), 'utf8');
  assert(checkout.includes("aria-invalid={errors.country ? 'true' : 'false'}"), 'Missing aria-invalid on country select');
  assert(checkout.includes('aria-describedby={errors.country ? \'country-error\' : undefined}'), 'Missing aria-describedby on country select');
  assert(checkout.includes('id="country-error" role="alert"'), 'Missing id="country-error" or role="alert" on country error');
});

// ── 5. MOBILE STICKY BAR SIZE INDICATOR & SELECTION GUARD ─────────
console.log('\n--- 5. Testing Mobile Sticky Bar Size & Selection Guard ---');

test('5.1 ProductDetailClient tracks hasExplicitSize state', () => {
  const pdp = fs.readFileSync(path.join(ROOT_DIR, 'src/app/shop/[productId]/ProductDetailClient.tsx'), 'utf8');
  assert(pdp.includes('const [hasExplicitSize, setHasExplicitSize] = useState<boolean>'), 'Missing hasExplicitSize state');
  assert(pdp.includes('sizeGroupRef'), 'Missing sizeGroupRef');
});

test('5.2 handleAdd guards against adding without explicit size selection', () => {
  const pdp = fs.readFileSync(path.join(ROOT_DIR, 'src/app/shop/[productId]/ProductDetailClient.tsx'), 'utf8');
  assert(pdp.includes('scrollToSizeSelector()'), 'Missing scrollToSizeSelector helper');
  assert(pdp.includes('if (!hasExplicitSize)') && pdp.includes('scrollToSizeSelector();'), 'handleAdd does not guard on hasExplicitSize');
});

test('5.3 Size chips update hasExplicitSize and expose aria-pressed', () => {
  const pdp = fs.readFileSync(path.join(ROOT_DIR, 'src/app/shop/[productId]/ProductDetailClient.tsx'), 'utf8');
  assert(pdp.includes('setHasExplicitSize(true)'), 'Size chip onClick does not call setHasExplicitSize(true)');
  assert(pdp.includes('aria-pressed={isSelected}'), 'Size chips missing aria-pressed attribute');
  assert(pdp.includes('role="group" aria-labelledby="pdp-size-label"'), 'Size container missing group role or accessible label');
});

test('5.4 Primary PDP button displays size or selection prompt', () => {
  const pdp = fs.readFileSync(path.join(ROOT_DIR, 'src/app/shop/[productId]/ProductDetailClient.tsx'), 'utf8');
  assert(pdp.includes('SELECT SIZE & ADD'), 'Primary button missing SELECT SIZE & ADD label when unselected');
  assert(pdp.includes('`ADD TO BAG • SIZE ${selectedVariant.size}`'), 'Primary button missing explicit size display');
});

test('5.5 Mobile sticky bar renders SIZE badge and CHOOSE SIZE button', () => {
  const pdp = fs.readFileSync(path.join(ROOT_DIR, 'src/app/shop/[productId]/ProductDetailClient.tsx'), 'utf8');
  assert(pdp.includes('stickyBarSizeBadge'), 'Sticky bar missing stickyBarSizeBadge class');
  assert(pdp.includes('SIZE: {selectedVariant.size}'), 'Sticky bar missing SIZE text');
  assert(pdp.includes("'CHOOSE SIZE'") && pdp.includes("'ADD TO BAG'"), 'Sticky bar missing CHOOSE SIZE state');
  assert(pdp.includes('stickyBarBtnSelect'), 'Sticky bar missing stickyBarBtnSelect class');
});

test('5.6 ProductDetailClient.module.css defines stickyBarSizeBadge and stickyBarBtnSelect', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'src/app/shop/[productId]/ProductDetailClient.module.css'), 'utf8');
  assert(css.includes('.stickyBarSizeBadge {'), 'CSS missing .stickyBarSizeBadge');
  assert(css.includes('.stickyBarBtnSelect {'), 'CSS missing .stickyBarBtnSelect');
});

console.log('\n====================================================');
console.log(`SUITE RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
