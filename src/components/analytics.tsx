'use client';

import Script from 'next/script';

export function Analytics() {
  return (
    <>
      <Script
        src="https://swetrix.org/swetrix.js"
        strategy="afterInteractive"
        onLoad={() => {
          // @ts-expect-error swetrix is loaded from external script
          window.swetrix?.init('7xsX0euF1mZy', {
            apiURL: 'http://swetrixapi-hw4so40800cgw004wg0cs44c.188.245.241.135.sslip.io/log',
          });
          // @ts-expect-error swetrix is loaded from external script
          window.swetrix?.trackViews();
        }}
      />
      <noscript>
        <img
          src="http://swetrixapi-hw4so40800cgw004wg0cs44c.188.245.241.135.sslip.io/log/noscript?pid=7xsX0euF1mZy"
          alt=""
          referrerPolicy="no-referrer-when-downgrade"
        />
      </noscript>
    </>
  );
}
