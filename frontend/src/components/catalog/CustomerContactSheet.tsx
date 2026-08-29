import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitCustomerContact } from '@/services/publicCatalog';

const DISMISS_KEY = 'dc_contact_prompt_done';

/** One-time, skippable. Once the customer saves *or* skips, we never ask
 *  again on this device. */
export function contactPromptDone(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function markDone() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * DPDP-Act-2023 aligned contact capture. Two *unbundled*, unticked consents:
 * processing (required to save) and marketing (optional). Skipping is a
 * first-class action — the shop still works fully without any details.
 */
export default function CustomerContactSheet({
  shopSlug,
  reason = 'browse',
  onClose,
  onSaved,
}: {
  shopSlug: string;
  reason?: 'browse' | 'selection';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [consentProcessing, setConsentProcessing] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const qc = useQueryClient();

  const hasContact = Boolean(name.trim() || whatsapp.trim() || email.trim());

  const mutation = useMutation({
    mutationFn: () =>
      submitCustomerContact(shopSlug, {
        name: name.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        consent_processing: consentProcessing,
        consent_marketing: consentMarketing,
      }),
    onSuccess: () => {
      markDone();
      qc.invalidateQueries({ queryKey: ['public', 'selection', shopSlug] });
      onSaved();
    },
  });

  function handleSkip() {
    markDone();
    onClose();
  }

  const heading =
    reason === 'selection'
      ? 'Save your selection to your name?'
      : 'Want the shop to help you faster?';
  const sub =
    reason === 'selection'
      ? 'Leave a number so staff can find your picks when you reach the counter. Optional.'
      : 'Leave your details and the shop can keep aside what you like. Completely optional.';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" onClick={handleSkip}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-3xl px-6 pb-8 pt-5 shadow-2xl sm:rounded-3xl"
        style={{ background: 'var(--catalog-card)', color: 'var(--catalog-ink)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10 sm:hidden" />
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Close"
          className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--catalog-heading-font)' }}>
          {heading}
        </h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--catalog-ink-muted)' }}>
          {sub}
        </p>

        <div className="mt-4 space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--catalog-hairline)', background: 'var(--catalog-bg)' }}
          />
          <input
            type="tel"
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Mobile / WhatsApp number"
            className="w-full rounded-xl border px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--catalog-hairline)', background: 'var(--catalog-bg)' }}
          />
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full rounded-xl border px-3.5 py-3 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--catalog-hairline)', background: 'var(--catalog-bg)' }}
          />
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2.5 text-xs leading-relaxed" style={{ color: 'var(--catalog-ink-muted)' }}>
            <input
              type="checkbox"
              checked={consentProcessing}
              onChange={(e) => setConsentProcessing(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--catalog-primary)]"
            />
            <span>
              I allow the shop to store these details to assist me with my purchase. I can ask them
              to delete it anytime.
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed" style={{ color: 'var(--catalog-ink-muted)' }}>
            <input
              type="checkbox"
              checked={consentMarketing}
              onChange={(e) => setConsentMarketing(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--catalog-primary)]"
            />
            <span>Also send me new arrivals and offers on WhatsApp or email.</span>
          </label>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-xs text-red-600">
            Could not save right now. You can still shop without this.
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 rounded-full border px-4 py-3 text-sm font-medium"
            style={{ borderColor: 'var(--catalog-hairline)', color: 'var(--catalog-ink-muted)' }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !hasContact || !consentProcessing}
            className="flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--catalog-primary), var(--catalog-accent))' }}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
