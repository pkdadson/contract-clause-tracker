const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const environment = {
  apiBase: isLocal ? 'http://localhost:8000/api' : 'https://contract-clause-tracker.fly.dev/api',
};
