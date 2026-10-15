import {useEffect} from 'react';
import {lockPageScroll} from './scrollLock';

/** Shared focus and scroll behavior for all module dialogs. */
export default function DialogAccessibility() {
 useEffect(() => {
  let active: HTMLElement | null = null;
  let restore: (() => void) | undefined;
  const sync = () => {
   const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"],.overlay > div,.erp-overlay > div'))
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
   const next = dialogs.at(-1) || null;
   if (next === active) return;
   restore?.(); restore = undefined; active = next;
   if (!next) return;
   const previous = document.activeElement as HTMLElement | null;
   const unlock = lockPageScroll();
   next.setAttribute('role', 'dialog'); next.setAttribute('aria-modal', 'true');
   if (!next.hasAttribute('aria-label') && !next.hasAttribute('aria-labelledby')) next.setAttribute('aria-label', next.querySelector('h2')?.textContent || 'Detalhes');
   const background: HTMLElement[] = [];
   let branch: HTMLElement | null = next;
   while (branch && branch !== document.body) {
    for (const sibling of Array.from(branch.parentElement?.children || [])) {
     if (sibling !== branch && sibling instanceof HTMLElement && !sibling.inert) { background.push(sibling); sibling.inert = true; }
    }
    branch = branch.parentElement;
   }
   const nodes = () => Array.from(next.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'))
    .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
   const oldTabIndex = next.getAttribute('tabindex');
   next.tabIndex = -1;
   // Keep autofocus and search fields selected by their owning module.
   if (!next.contains(document.activeElement)) (nodes()[0] || next).focus({preventScroll: true});
   // Drawer effects may still be releasing inert when a dialog opens.
   const focusFrame = requestAnimationFrame(() => {
    if (!next.contains(document.activeElement)) (nodes()[0] || next).focus({preventScroll: true});
   });
   const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
     const close = next.querySelector<HTMLButtonElement>('button[aria-label^="Fechar"]');
     if (close) { event.preventDefault(); event.stopImmediatePropagation(); close.click(); }
    }
    if (event.key === 'Tab') {
     const all = nodes(), first = all[0], last = all.at(-1);
     if (!first) { event.preventDefault(); next.focus(); }
     else if (!next.contains(document.activeElement) || document.activeElement === next || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus();
     }
    }
   };
   document.addEventListener('keydown', key, true);
   restore = () => {
    cancelAnimationFrame(focusFrame);
    document.removeEventListener('keydown', key, true);
    background.forEach(el => { el.inert = false; });
    if (oldTabIndex === null) next.removeAttribute('tabindex'); else next.setAttribute('tabindex', oldTabIndex);
    unlock();
    if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({preventScroll: true});
   };
  };
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {childList: true, subtree: true}); sync();
  return () => { observer.disconnect(); restore?.(); };
 }, []);
 return null;
}
