/**
 * Shop-owner "Leads" — customers who left their details on the catalog,
 * with the products they added to My Choice. Read-only: there is no
 * per-item workflow, the customer just shows their phone in person.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ImageOff, Mail, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getLeads } from '@/services/shopOwner';
import { getApiErrorMessage } from '@/utils/apiError';
import { effectivePrice, formatPrice } from '@/utils/currency';
import ErrorState from '@/components/ErrorState';
import Spinner from '@/components/Spinner';
import type { Lead } from '@/types/dashboard';

/** wa.me needs a country-coded, digits-only number. Assume +91 for a bare
 *  10-digit Indian mobile; otherwise pass through the digits as given. */
function waLink(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `https://wa.me/91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `https://wa.me/${digits}`;
  return null;
}

function LeadCard({ lead }: { lead: Lead }) {
  const wa = lead.whatsapp ? waLink(lead.whatsapp) : null;
  const total = lead.selected_items.reduce(
    (sum, i) => sum + effectivePrice(i.price, i.discount_percent),
    0,
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {lead.name || 'Unnamed customer'}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
            {format(parseISO(lead.created_at), 'd MMM yyyy, h:mm a')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lead.consent_marketing && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              Opted in
            </span>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Mail className="h-3.5 w-3.5" />
              Email
            </a>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
        {lead.whatsapp && <span>{lead.whatsapp}</span>}
        {lead.email && <span>{lead.email}</span>}
      </div>

      {lead.selected_items.length > 0 ? (
        <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            Selected {lead.selected_items.length} item{lead.selected_items.length === 1 ? '' : 's'} ·{' '}
            {formatPrice(total)}
          </p>
          <ul className="mt-2 space-y-2">
            {lead.selected_items.map((item) => (
              <li key={item.product_id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  {item.primary_image_url ? (
                    <img src={item.primary_image_url} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-800 dark:text-neutral-200">{item.name}</p>
                  {item.note && <p className="truncate text-xs text-neutral-400">“{item.note}”</p>}
                </div>
                <span className="shrink-0 text-right text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                  {formatPrice(effectivePrice(item.price, item.discount_percent))}
                  {item.discount_percent ? (
                    <span className="ml-1 text-xs font-normal text-neutral-400 line-through">
                      {formatPrice(item.price)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-400 dark:border-neutral-800">
          No items selected.
        </p>
      )}
    </div>
  );
}

export default function LeadsPage() {
  const { shop } = useAuth();
  const shopId = shop?.id;
  const [onlyOptedIn, setOnlyOptedIn] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<Lead[]>({
    queryKey: ['shop-owner', 'leads', shopId],
    queryFn: () => getLeads(shopId as number),
    enabled: Number.isFinite(shopId),
    staleTime: 30_000,
  });

  const leads = useMemo(
    () => (onlyOptedIn ? (data ?? []).filter((l) => l.consent_marketing) : data ?? []),
    [data, onlyOptedIn],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Leads</h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Customers who left their details, and what they chose
          </p>
        </div>
        {data && data.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={onlyOptedIn}
              onChange={(e) => setOnlyOptedIn(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            Marketing opt-ins only
          </label>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {isError && <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />}

      {data && leads.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <Users className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
          <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {onlyOptedIn ? 'No marketing opt-ins yet' : 'No leads yet'}
          </p>
          <p className="mt-1 max-w-xs text-sm text-neutral-400">
            When a customer fills the contact form on your catalog, they show up here with what
            they chose.
          </p>
        </div>
      )}

      {leads.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {leads.map((lead) => (
            <LeadCard key={lead.contact_id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
