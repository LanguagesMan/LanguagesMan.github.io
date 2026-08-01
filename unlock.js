/* Site-wide buyer awareness. Include on every public page (NOT the reader — it has its own logic).
   If the visitor owns the $9 book, every "buy the $9 book" CTA is swapped to
   "📖 Open your book" → the reader. So a buyer is NEVER re-asked to pay $9 anywhere.
   Ownership = localStorage 'languy_book_key', which ONLY the reader sets after the key
   passes the server check (/api/book-unlock). No purchase key appears in this file —
   forging the flag by hand just changes button labels; the content stays server-gated. */
(function () {
  try {
    var params = new URLSearchParams(location.search);
    var q = params.get('unlock');
    // Founder preview: the IAMLANGUY code / ?founder=1 / the persistent HQ flag.
    // This is a LIVE, reversible preview — it persists ONLY the founder flag itself,
    // never book ownership. Clearing languy_founder reverts every page.
    var founder = (q || '').toUpperCase() === 'IAMLANGUY' || params.get('founder') === '1'
      || localStorage.getItem('languy_founder') === 'IAMLANGUY';
    if (founder) localStorage.setItem('languy_founder', 'IAMLANGUY');
    var owns = !!localStorage.getItem('languy_book_key');
    if (!owns && !founder) return;   // neither bought nor previewing → leave buy-CTAs as buy

    document.documentElement.classList.add('has-book');

    function swap() {
      document.querySelectorAll('a[href]').forEach(function (a) {
        if (a.hasAttribute('data-keep')) return;
        var h = a.getAttribute('href') || '';
        var t = (a.textContent || '');
        var isBookBuy =
          a.hasAttribute('data-book-buy') ||
          a.getAttribute('data-buy-kind') === 'method-guide' ||   // Stripe $9 book button (Gumroad retired 2026-07-04)
          (/reader-zk7p3/i.test(h) && /\$9|get it|get the method|the method guide|starter guide|the book|switch it back/i.test(t));
        if (!isBookBuy) return;
        a.textContent = (owns ? '📖 Open your book' : '📖 Open your book · founder view');
        if (!owns) a.setAttribute('title', 'Founder preview — real visitors see the $9 buy button here');
        // no key in the URL — the reader reads the stored key and re-verifies server-side
        a.setAttribute('href', '/reader-zk7p3/');
        a.removeAttribute('target');
      });
    }
    if (document.readyState !== 'loading') swap();
    else document.addEventListener('DOMContentLoaded', swap);
  } catch (e) { /* never break a page */ }
})();
