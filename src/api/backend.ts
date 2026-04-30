export const getBackendBaseUrl = () => {
  const env = import.meta.env;
  const configured = (env.VITE_BACKEND_URL as string | undefined)?.trim();

  if (configured) {
    // Prevent a common misconfig: leaving localhost set in production.
    if (env.PROD && /^https?:\/\/localhost(?::|$)/i.test(configured)) {
      return '';
    }
    return configured.replace(/\/+$/, '');
  }

  // In production (Vercel), prefer same-origin API routes.
  if (env.PROD) return '';

  // Local dev default.
  return 'http://localhost:3001';
};

export const withBackend = (urlPath: string) => {
  const base = getBackendBaseUrl();
  const path = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  return base ? `${base}${path}` : path;
};

export const readJson = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('application/json')) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  throw new Error(text || `HTTP ${response.status}`);
};
