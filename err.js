/* First-party client error monitoring → /api/track (no external service, no key).
   Catches uncaught JS errors, unhandled promise rejections, and failed resource
   loads, and beacons a compact report to /api/track (Vercel logs = the store).
   Robot-filtered so test agents never pollute. Capped per page-load. */
(function () {
  try {
    if (navigator.webdriver === true || /[?&]robot=1\b/.test(location.search)) return;
    var sent = 0, MAX = 8;
    function report(tag, detail) {
      if (sent >= MAX) return; sent++;
      try {
        var body = JSON.stringify({
          event: 'jserror',
          page: location.pathname,
          ref: (tag + ': ' + detail).slice(0, 200)
        });
        if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
        else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
      } catch (e) {}
    }
    window.addEventListener('error', function (e) {
      if (e && e.target && (e.target.src || e.target.href)) report('resource', (e.target.src || e.target.href || '').slice(0, 160));
      else report('js', ((e && e.message) || 'error') + (e && e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : ''));
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
      var r = e && e.reason; report('promise', (r && (r.message || r)) || 'unhandled');
    });
  } catch (_) {}
})();
