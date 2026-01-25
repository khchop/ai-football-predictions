'use client';

import Script from 'next/script';

export function Analytics() {
  return (
    <Script
      src="http://umami-w8swgckkgosssco00k0go4g8.188.245.241.135.sslip.io/script.js"
      data-website-id="2e966abd-99fc-4363-8007-3737d99bc4c1"
      strategy="afterInteractive"
    />
  );
}
