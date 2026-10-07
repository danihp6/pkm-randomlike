/**
 * The phone's own Back gesture and hardware Back button. The browser turns them
 * into a history pop, so a screen arms one history entry and re-arms it after
 * every pop: the Back gesture reaches `handler` (the pause menu) instead of
 * leaving the page. Returns a detach function for the scene's shutdown.
 */
export function listenForBack(handler: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') return () => undefined;

  const arm = (): void => {
    window.history.pushState({ pkm: 'back-guard' }, '');
  };
  const onPopState = (): void => {
    handler();
    arm();
  };

  arm();
  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
}
