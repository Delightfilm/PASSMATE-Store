// The mobile deadline starts in <head>, before DOMContentLoaded can be delayed.
export const storeFontGuard = `(() => {
  if (!matchMedia('(max-width:767px)').matches || !(location.pathname === '/' || ['/products','/library'].some(p => location.pathname === p || location.pathname.startsWith(p + '/')) || location.pathname.startsWith('/account/login'))) return;
  const root = document.documentElement;
  let shown = false;
  const reveal = fallback => {
    if (shown) return;
    shown = true;
    clearTimeout(deadline);
    if (fallback) root.classList.add('store-font-fallback');
    root.classList.remove('store-font-pending');
  };
  root.classList.add('store-font-pending');
  // Reserve 50ms for timer scheduling and the next paint within the 1.5s budget.
  const deadline = setTimeout(() => reveal(true), 1450);
  const ready = () => {
    if (!document.fonts) return reveal(true);
    document.fonts.ready.then(() => reveal([...document.fonts].some(face => face.status === 'error')), () => reveal(true));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true});
  else ready();
})();`;
