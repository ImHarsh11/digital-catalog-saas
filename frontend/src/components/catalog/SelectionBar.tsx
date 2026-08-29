import { Link } from 'react-router-dom';
import { ChevronRight, Heart } from 'lucide-react';
import { useSelection } from '@/hooks/useSelection';

/**
 * Floating pill that shows the live count of the customer's picks and
 * links to the "My Choice" page. Hidden while the list is empty. Sits
 * above the mobile bottom-nav so both stay tappable.
 */
export default function SelectionBar({ slug, bottomClass = 'bottom-20 sm:bottom-6' }: { slug: string; bottomClass?: string }) {
  const { count } = useSelection(slug);
  if (count === 0) return null;

  return (
    <div className={`fixed left-1/2 z-40 -translate-x-1/2 ${bottomClass}`}>
      <Link
        to={`/shop/${slug}/my-choice`}
        className="flex items-center gap-2.5 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(135deg, var(--catalog-primary), var(--catalog-accent))',
        }}
      >
        <Heart className="h-4 w-4 fill-white" />
        <span>
          My Choice · {count} item{count === 1 ? '' : 's'}
        </span>
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
