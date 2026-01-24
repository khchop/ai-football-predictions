import { loggers } from '@/lib/logger/modules';

const log = loggers.api;

interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
}

/**
 * Ping IndexNow to notify search engines of URL updates
 * 
 * Engines to ping:
 * - api.indexnow.org
 * - www.bing.com
 * - search.yandex.com
 */
export async function pingIndexNow(urls: string[]) {
  const host = 'kroam.xyz';
  const key = process.env.INDEXNOW_KEY;
  
  if (!key) {
    log.warn('INDEXNOW_KEY not configured, skipping ping');
    return;
  }

  if (urls.length === 0) return;

  const payload: IndexNowPayload = {
    host,
    key,
    urlList: urls
  };

  const endpoints = [
    'https://api.indexnow.org/indexnow',
    'https://www.bing.com/indexnow',
    'https://search.yandex.com/indexnow'
  ];

  log.info({ urls, count: urls.length }, 'Pinging IndexNow');

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        log.error({ endpoint, status: response.status, error: text }, 'IndexNow ping failed');
      } else {
        log.info({ endpoint }, 'IndexNow ping successful');
      }
    } catch (error) {
      log.error({ endpoint, error }, 'IndexNow ping exception');
    }
  }
}
