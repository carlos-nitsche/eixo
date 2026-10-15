/** Shared lock prevents a closing drawer from unlocking an opening dialog. */
let locks = 0;
let restore: (() => void) | undefined;

export function lockPageScroll() {
 if (locks++ === 0) {
  const y = window.scrollY, body = document.body, old = body.style.cssText;
  const gutter = window.innerWidth - document.documentElement.clientWidth;
  const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
  Object.assign(body.style, {position: 'fixed', top: `-${y}px`, width: '100%'});
  if (gutter > 0) body.style.paddingRight = `${padding + gutter}px`;
  restore = () => { body.style.cssText = old; window.scrollTo({top: y, behavior: 'instant'}); };
 }
 let released = false;
 return () => {
  if (released) return;
  released = true;
  if (--locks === 0) { restore?.(); restore = undefined; }
 };
}
