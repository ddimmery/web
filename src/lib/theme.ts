/**
 * The two inline scripts behind the header's light / dark / system control.
 *
 * Kept as strings (like `lib/scroll-spy.ts`) so Astro emits them verbatim, and
 * kept tiny: together they are the site's only first-party JavaScript besides
 * the scroll-spy. Nothing here is bundled or hashed — both go out inline.
 *
 * Storage contract, shared by both halves:
 *   localStorage['theme'] === 'light' | 'dark'  -> forced, stamped on <html>
 *   absent (or anything else)                   -> follow prefers-color-scheme
 *
 * The CSS mirror of that contract lives in src/styles/global.css: light values
 * sit unconditionally on `:root`, dark is applied both by
 * `prefers-color-scheme` (guarded with `:not([data-theme='light'])`) and by
 * `[data-theme='dark']`.
 */

/**
 * Pre-paint stamp. Must run in `<head>`, parser-blocking, before the first
 * paint — otherwise a visitor who forced dark would see a flash of the light
 * ground (or vice versa). Deliberately synchronous and deliberately first.
 */
export const themeInit = `(function(){try{
var t=localStorage.getItem('theme');
if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;
}catch(e){}})();`
  .split('\n')
  .join('');

/**
 * The control itself, emitted immediately after the button so the button is
 * already parsed. It reveals the button (which ships `hidden`, so no-JS
 * visitors never see a dead control), then cycles system -> light -> dark on
 * click, writing storage and re-stamping <html>.
 *
 * `data-mode` on the button drives which of the three inline SVGs is visible,
 * and the accessible name states the current mode plus what the next click
 * does — the whole point of the label is that "system" is distinguishable from
 * a forced choice.
 */
export const themeToggle = `(function(){
var r=document.documentElement,b=document.getElementById('theme-toggle');
if(!b)return;
var m=['system','light','dark'];
function set(v,w){
if(v==='system'){delete r.dataset.theme}else{r.dataset.theme=v}
if(w){try{v==='system'?localStorage.removeItem('theme'):localStorage.setItem('theme',v)}catch(e){}}
b.dataset.mode=v;
b.setAttribute('aria-label','Theme: '+v+'. Switch to '+m[(m.indexOf(v)+1)%3]+'.');
b.setAttribute('title','Theme: '+v);
}
b.addEventListener('click',function(){set(m[(m.indexOf(b.dataset.mode||'system')+1)%3],1)});
set(r.dataset.theme==='dark'?'dark':r.dataset.theme==='light'?'light':'system',0);
b.hidden=false;
})();`
  .split('\n')
  .join('');
