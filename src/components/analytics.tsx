'use client';

import Script from 'next/script';

export function Analytics() {
  return (
    <Script
      src="https://umami.kroam.xyz/script.js"
      data-website-id="2e966abd-99fc-4363-8007-3737d99bc4c1"
      strategy="afterInteractive"
    />
  );
}
