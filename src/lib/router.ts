import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'level'; levelId: string }
  | { name: 'play' }
  | { name: 'result'; id: string }
  | { name: 'wrong' }
  | { name: 'flashcards' }
  | { name: 'exam' }
  | { name: 'examPlay' }
  | { name: 'examResult' }
  | { name: 'community' }
  | { name: 'communityUpload' }
  | { name: 'communityMine' }
  | { name: 'communityPlay' }
  | { name: 'communityResult' }
  | { name: 'notFound' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '');
  if (!path) return { name: 'home' };
  const [head, second] = path.split('/');
  if (head === 'map') return { name: 'map' };
  if (head === 'play') return { name: 'play' };
  if (head === 'wrong') return { name: 'wrong' };
  if (head === 'flashcards') return { name: 'flashcards' };
  if (head === 'exam') {
    if (!second) return { name: 'exam' };
    if (second === 'play') return { name: 'examPlay' };
    if (second === 'result') return { name: 'examResult' };
    return { name: 'notFound' };
  }
  if (head === 'community') {
    if (!second) return { name: 'community' };
    if (second === 'upload') return { name: 'communityUpload' };
    if (second === 'mine') return { name: 'communityMine' };
    if (second === 'play') return { name: 'communityPlay' };
    if (second === 'result') return { name: 'communityResult' };
    return { name: 'notFound' };
  }
  if (head === 'level' && second) return { name: 'level', levelId: decodeURIComponent(second) };
  if (head === 'result' && second) return { name: 'result', id: decodeURIComponent(second) };
  return { name: 'notFound' };
}

export function navigate(path: string, replace = false): void {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) return;
  if (replace) {
    const url = `${window.location.pathname}${window.location.search}${target}`;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
