import { useEffect, useState } from 'react';

/**
 * True when <html> carries the `dark` class. Updates reactively when the
 * class changes (theme toggle or OS change). Used by the chart layer to
 * pick the right palette steps for the active surface.
 */
export function useDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
