/* Languy feedback widget: floating chat button -> "Tell Languy" sheet. No deps. Light-brand
   panel (warm paper, near-black ink, #0F80F0 azure) — self-contained white surface so it stays
   legible on the few remaining dark game/reader surfaces too, per languy-tokens.css. */
(function(){
'use strict';
if(window.__languyFeedbackWidget)return;window.__languyFeedbackWidget=true;
var page=location.pathname||'/';
function isBot(){try{if(navigator.webdriver)return true;if(new URLSearchParams(location.search).get('robot')==='1')return true}catch(e){}return false}
var BOT=isBot();
/* First-touch traffic attribution (2026-07-16): compact source tag so a founder post can be traced
   to visits/opt-ins. Priority: explicit ?src= > utm_source(-medium-campaign) > referrer hostname
   (lowercase, no path/query, capped). Computed once per browser session and persisted in
   sessionStorage so every later event this visit — not just the landing pageview — carries the
   SAME first-touch value, even after in-site navigation drops the original URL params/referrer.
   Sent as the existing `src` field api/track.js already accepts; never overwrites a `src` an event
   sets itself (e.g. js_error's filename) — see the guard in beacon() below. */
var FT_KEY='__lgy_ft';
function ftClean(v,n){return String(v||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'').slice(0,n)}
function ftCompute(){try{var sp=new URLSearchParams(location.search);var tag=ftClean(sp.get('src'),24)||[ftClean(sp.get('utm_source'),20),ftClean(sp.get('utm_medium'),20),ftClean(sp.get('utm_campaign'),20)].filter(Boolean).join('-').slice(0,40);var refHost='';try{if(document.referrer)refHost=new URL(document.referrer).hostname.replace(/^www\./,'').toLowerCase().slice(0,64)}catch(_){}return tag||refHost||''}catch(_){return''}}
var FIRST_TOUCH='';
if(!BOT){try{var ftStored=sessionStorage.getItem(FT_KEY);if(ftStored===null){FIRST_TOUCH=ftCompute();sessionStorage.setItem(FT_KEY,FIRST_TOUCH)}else{FIRST_TOUCH=ftStored}}catch(_){FIRST_TOUCH=ftCompute()}}
/* THE FOUR NUMBERS (THE_ONE_SYSTEM § WHAT WE MEASURE, 2026-07-29). Three of the four are ratios of
   PEOPLE, so events need one anonymous id per person: `languy_did`, the SAME random local-only
   string the Passport + shared/game-beacon.js already make. Not derived from the person, not shared
   cross-site, never sent with an email or name. No new identifier. Full rationale: api/track.js. */
var DID='';
if(!BOT){try{DID=localStorage.getItem('languy_did')||'';if(!DID){DID='d'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem('languy_did',DID)}}catch(e){}}
function beacon(ev,extra){if(BOT)return;try{var payload=Object.assign({event:ev,page:page,ref:document.referrer||''},extra||{});if(FIRST_TOUCH&&!payload.src)payload.src=FIRST_TOUCH;if(DID&&!payload.anon)payload.anon=DID;var b=JSON.stringify(payload);if(navigator.sendBeacon){navigator.sendBeacon('/api/track',new Blob([b],{type:'application/json'}))}else{fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:b,keepalive:true}).catch(function(){})}}catch(e){}}
/* ONE SENDER, not two. Pages that need to beacon their own product events (free.html's chain
   player, 2026-07-31) used to hand-roll a second sendBeacon call with their own bot check, which
   is how a page ends up with two slightly different definitions of "a real visitor". Exposing the
   canonical beacon means those events inherit the SAME bot filter, the SAME first-touch `src` and
   the SAME anonymous id as every other event, and land in the same events/<day>/<event>/ store
   api/funnel-stats.js already counts. It is deliberately not a new pipeline — it is the existing
   one, reachable. Callers own their own once-per-session guards; this function does not dedupe. */
try{window.languyTrack=beacon}catch(e){}
beacon('pageview');
/* NUMBER 1 — did they hear a word. free.html plays via `new Audio()` on a DETACHED element, whose
   events never reach document, so a document listener alone would miss the one page that matters;
   wrapping play() catches both, returns the original promise untouched, fires once per page. No
   autoplay anywhere on /free, so this only ever means a human tapped and heard a word. */
var HEARD=false;
function heardWord(){if(HEARD||BOT)return;HEARD=true;beacon('word_heard')}
try{var _mp=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){heardWord();return _mp.apply(this,arguments)}}catch(e){}
document.addEventListener('play',heardWord,true);
/* NUMBER 4 — did the buyer use it within 48h. Joins purchase to first use WITHOUT knowing who they
   are: a one-way sha256 (24 hex) of the Stripe session id, computed here because that id unlocks a
   paid product and must never be sent — only the digest is. api/stripe-webhook.js writes the same
   digest on the sale. Founder keys aren't `cs_` sessions, so a preview never counts as a buyer. */
function buyerSession(){try{var q=new URLSearchParams(location.search).get('session_id')||'';if(/^cs_[A-Za-z0-9_]+$/.test(q))return q;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||'';if(!/^languy_(course|book|pack|bundle)_key/.test(k))continue;var v=(localStorage.getItem(k)||'').replace(/^sess:/,'');if(/^cs_[A-Za-z0-9_]+$/.test(v))return v}}catch(e){}return''}
if(!BOT)try{var _bs=buyerSession();if(_bs&&window.crypto&&crypto.subtle&&window.TextEncoder){crypto.subtle.digest('SHA-256',new TextEncoder().encode(_bs)).then(function(buf){var h='';new Uint8Array(buf).forEach(function(x){h+=x.toString(16).padStart(2,'0')});beacon('buyer_use',{bh:h.slice(0,24)})}).catch(function(){})}}catch(e){}
document.addEventListener('click',function(e){var el=e.target&&e.target.closest&&e.target.closest('[data-buy],[data-buy-kind]');if(el)beacon('buy-click',{ref:el.getAttribute('data-buy')||el.getAttribute('data-buy-kind')||''})},true);
document.addEventListener('submit',function(e){try{var f=e.target;if(!f||f.tagName!=='FORM')return;var a=(f.getAttribute('action')||'')+' '+(f.id||'')+' '+(f.getAttribute('data-track')||'');if(/subscribe|kit|email|lead|capture|signup|join/i.test(a)||f.querySelector('input[type=email]'))beacon('email_submit',{form:f.id||f.getAttribute('data-track')||'form'})}catch(_){}},true);
/* ERROR REPORTING (2026-07-29, hardened mid-spike). 86% of tonight's traffic is inside Instagram's
   in-app webview, which injects its own bridge script into our page — 19 of 19 errors reported in the
   first hour were third-party, so our error signal could not have shown a real bug. api/track.js now
   sorts every report into js_error (ours) / js_error_3p / js_error_unknown; the SERVER owns that
   verdict, because pages we don't control (err.js and a few product pages) beacon here too. What the
   client adds is the evidence the server cannot see: `sf`, the first stack frame's file, which is the
   only way a promise rejection from our own code can ever be proved ours — window.onerror hands us no
   filename for those, and without it every one would fall into the unknown bucket forever.
   Errors are capped per page-load: an error inside a render loop must not turn into a beacon flood
   that drowns the signal we just cleaned up (and burns the rate limiter). */
var ERRS=0,ERR_MAX=8;
function stackFile(err){try{var st=err&&err.stack;if(!st)return'';var m=String(st).match(/(?:https?:\/\/|\/)[^\s():]+\.(?:js|mjs)(?=[?#:]|$)/);return m?m[0].slice(0,120):''}catch(_){return''}}
function reportError(msg,src,ln,err){if(BOT||ERRS>=ERR_MAX)return;ERRS++;var p={msg:String(msg||'').slice(0,180),ln:ln||0};if(src)p.src=String(src).slice(0,120);var sf=stackFile(err);if(sf)p.sf=sf;beacon('js_error',p)}
window.addEventListener('error',function(ev){try{
/* A failed <img>/<script>/<audio> load fires error on the ELEMENT, not the window, and carries no
   message — reported distinctly so a genuinely broken asset of ours stays loud instead of arriving as
   a blank message that looks like cross-origin noise. */
var t=ev&&ev.target;if(t&&t!==window&&(t.src||t.href)){var rp={msg:'resource failed to load',kind:'resource',src:String(t.src||t.href||'').slice(0,120)};if(!BOT&&ERRS<ERR_MAX){ERRS++;beacon('js_error',rp)}return}
reportError((ev&&ev.message)||'',(ev&&ev.filename)||'',(ev&&ev.lineno)||0,ev&&ev.error)}catch(_){}},true);
window.addEventListener('unhandledrejection',function(ev){try{var r=ev&&ev.reason;var m=(r&&(r.message||(r.toString&&r.toString())))||'';reportError('promise: '+m,'',0,r)}catch(_){}});
/* The launcher was a WHITE circle carrying a speech-balloon emoji on a near-black page — off-system twice over
   (a light chip floating on dark, and a colour emoji doing the job of an icon, the last emoji-as-UI
   left on the funnel). It is now a monochrome dark chip with a stroked speech-bubble drawn in
   currentColor: one flat ink tone, no colour accent, legible on the dark /free surface AND on the
   light pages, since a near-black chip reads as deliberate on both. Bottom offset clears the
   iOS/Android home indicator via safe-area, and sits above the in-app browser's own bottom chrome. */
/* -webkit-tap-highlight-color: the OS paints a translucent BLUE wash over whatever a thumb touches,
   which on a monochrome control is a colour accent we did not choose — caught by looking at a real
   390x844 tap screenshot, where the just-tapped star came back tinted blue instead of ink. Killed on
   every interactive element here; the focus ring below still carries keyboard a11y. */
var css=".lb,.lc,.la,.lt,.le,.ln{-webkit-tap-highlight-color:transparent}.la,.lb{-webkit-user-select:none;user-select:none}.lb,.lc,.la,.lt,.le{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05);cursor:pointer;border-radius:12px}.lb,.la,.ln,.lc{min-height:44px}.lb{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));width:44px;height:44px;border-radius:50%;background:#14171E;border:1px solid rgba(255,255,255,.20);color:#EEF2F8;padding:0;display:flex;align-items:center;justify-content:center;z-index:2147483000;box-shadow:0 6px 20px rgba(0,0,0,.40);transition:transform .2s cubic-bezier(.16,1,.3,1)}.lb svg{width:20px;height:20px;display:block;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.lb:active{transform:scale(.92)}.ld{position:fixed;inset:0;background:rgba(14,20,32,.45);backdrop-filter:blur(6px);z-index:2147483001;opacity:0;pointer-events:none;transition:opacity .25s cubic-bezier(.16,1,.3,1);display:flex;align-items:flex-end;justify-content:center}.ld.lo{opacity:1;pointer-events:auto}@media(min-width:640px){.ld{align-items:center}}.ls{width:100%;max-width:420px;background:#111726;color:#EEF2F8;border-radius:20px 20px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));transform:translateY(24px);opacity:0;transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .3s cubic-bezier(.16,1,.3,1);font:15px/1.4 var(--sans),'Instrument Sans',-apple-system,system-ui,sans-serif;box-sizing:border-box;max-height:88vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,.55)}.ld.lo .ls{transform:translateY(0);opacity:1}.lh{font-weight:800;font-size:19px;margin:0 0 4px}.lu{color:#8A93A3;font-size:14px;margin:0 0 16px}.lp{display:flex;gap:8px;margin-bottom:16px}.la{flex:1;display:flex;align-items:center;justify-content:center;color:#8A93A3;background:rgba(255,255,255,.05)}.la svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.la.lg{border-color:#2563EB;background:#2563EB;color:#FFFFFF}.la.lg svg{fill:currentColor}.lk{display:flex;width:46px;height:46px;margin:0 auto 12px;border-radius:50%;background:#2563EB;color:#FFFFFF;align-items:center;justify-content:center}.lk svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.lt,.le{width:100%;color:#EEF2F8;background:rgba(255,255,255,.05);font:inherit;box-sizing:border-box;margin-bottom:12px}.lt{min-height:88px;padding:12px 14px;resize:vertical}.le{min-height:44px;padding:0 14px;margin-bottom:16px}.lt:focus,.le:focus{outline:none;border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.28)}.le::placeholder,.lt::placeholder{color:#7B8493}.lr{display:flex;gap:10px}.ln{flex:1;border-radius:12px;border:1px solid #2563EB;background:#2563EB;color:#fff;font-weight:800;font-size:15px;cursor:pointer}.ln:disabled{opacity:.55}.lc{color:#8A93A3;min-width:44px;font-size:15px;padding:0 16px;background:transparent;border-color:transparent}.lf{color:#DC2626;font-size:13px;margin:-6px 0 12px}.lx{text-align:center;padding:12px 0 4px}.lj{position:absolute;left:-9999px}";
var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
/* Monochrome line icons, drawn in currentColor — no emoji anywhere in this widget's UI. */
var SVG_BUBBLE='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 11.6a8.2 8.2 0 0 1-8.3 8.1 8.5 8.5 0 0 1-3.7-.85L3.5 20.4l1.6-4.9a8.2 8.2 0 0 1-.9-3.7 8.2 8.2 0 0 1 8.3-8.1h.5a8.2 8.2 0 0 1 7.5 7.5z"/></svg>';
var SVG_STAR='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.1l2.75 5.6 6.15.85-4.45 4.35 1.05 6.15L12 17.15 6.5 20.05l1.05-6.15L3.1 9.55l6.15-.85z"/></svg>';
var SVG_CHECK='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 6.5L9.4 17.1 4.5 12.2"/></svg>';
var btn=document.createElement('button');btn.className='lb';btn.type='button';btn.setAttribute('aria-label','Send feedback to Languy');btn.innerHTML=SVG_BUBBLE;
var bd=document.createElement('div');bd.className='ld';
var rating=0;
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function stars(){var o='';for(var i=1;i<=5;i++)o+='<div class="la" data-v="'+i+'" role="button" tabindex="0" aria-label="'+i+' out of 5">'+SVG_STAR+'</div>';return o}
function formHtml(){return '<h2 class="lh">Tell Languy</h2><p class="lu">Quick take on '+esc(page)+' — I read every one.</p><div class="lp">'+stars()+'</div><textarea class="lt" data-el="msg" maxlength="2000" placeholder="What worked, what did not..."></textarea><input class="le" data-el="email" type="email" placeholder="Want a reply? Leave your email (optional)"><input class="lj" data-el="hp" type="text" tabindex="-1" autocomplete="off"><div class="lf" data-el="err"></div><div class="lr"><button class="lc" type="button" data-el="cancel">Close</button><button class="ln" type="button" data-el="send">Send</button></div>'}
function thanksHtml(){return '<div class="lx"><span class="lk">'+SVG_CHECK+'</span><h2 class="lh">Got it, player.</h2><p class="lu">Languy reads everything.</p><button class="lc" type="button" data-el="done" style="width:100%">Close</button></div>'}
var sh=document.createElement('div');sh.className='ls';sh.innerHTML=formHtml();bd.appendChild(sh);
var isOpen=false;
function open(){if(isOpen)return;isOpen=true;sh.innerHTML=formHtml();rating=0;bd.classList.add('lo');document.body.style.overflow='hidden';beacon('feedback-open')}
function close(){if(!isOpen)return;isOpen=false;bd.classList.remove('lo');document.body.style.overflow=''}
btn.addEventListener('click',open);
bd.addEventListener('click',function(e){if(e.target===bd)close()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
sh.addEventListener('click',function(e){
var se=e.target.closest&&e.target.closest('.la');
if(se){rating=parseInt(se.getAttribute('data-v'),10);sh.querySelectorAll('.la').forEach(function(s){s.classList.toggle('lg',parseInt(s.getAttribute('data-v'),10)<=rating)});return}
var t=e.target.getAttribute&&e.target.getAttribute('data-el');
if(t==='cancel'||t==='done'){close();return}
if(t==='send')submit();
});
function q(k){return sh.querySelector('[data-el="'+k+'"]')}
function submit(){
var m=q('msg'),em=q('email'),hp=q('hp'),er=q('err'),sb=q('send');
var message=m?m.value.trim():'',email=em?em.value.trim():'';
if(!message&&!rating){if(er)er.textContent='Add a rating or a note first.';return}
if(er)er.textContent='';
if(sb){sb.disabled=true;sb.textContent='Sending…'}
fetch('/api/feedback-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:page,rating:rating||undefined,message:message,email:email||undefined,hp:hp?hp.value:'',meta:{ua:navigator.userAgent.slice(0,120)}})})
.then(function(r){return r.json().catch(function(){return{ok:false}})})
.then(function(d){
if(d&&d.ok){beacon('feedback-sent',{ref:rating?String(rating):''});sh.innerHTML=thanksHtml()}
else{if(er)er.textContent=(d&&d.error)||'Could not send — try again.';if(sb){sb.disabled=false;sb.textContent='Send'}}
})
.catch(function(){if(er)er.textContent='Could not send — check your connection.';if(sb){sb.disabled=false;sb.textContent='Send'}});
}
function mount(){document.body.appendChild(btn);document.body.appendChild(bd)}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',mount)}else{mount()}
})();
