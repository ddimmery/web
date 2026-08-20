/**
 * Inline scroll-spy for the sticky sidebar outline — the site's one deliberate
 * exception to zero client JS, shared by post pages and the research index so
 * both outlines behave identically.
 *
 * Progressive enhancement: the outline works fully without it, and pages only
 * emit it when they actually render a sidebar outline.
 *
 * A rAF-throttled scroll listener rather than a bare IntersectionObserver: an
 * observer only reports *changes* in intersection, so a jump — an in-page
 * anchor, a restored scroll position, a fast flick — can move several targets
 * past the trigger band without firing at all.
 *
 * The selector is the sidebar outline itself (there is at most one per page),
 * so the same script serves any page shell; targets are whatever the outline's
 * own links point at, which on posts are headings and on research are the
 * section and year anchors.
 *
 * Kept as a string so Astro emits it verbatim, stripped of newlines on the way
 * out.
 */
export const scrollSpy = `(function(){
var t=document.querySelector('.toc--sidebar');
if(!t)return;
var m={},s=[];
Array.prototype.forEach.call(t.querySelectorAll('a[href^="#"]'),function(a){
var e=document.getElementById(decodeURIComponent(a.hash.slice(1)));
if(e){m[e.id]=a;s.push(e)}});
if(!s.length)return;
s.sort(function(a,b){return a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1});
var cur=null,queued=false;
function u(){queued=false;
var hit=null,line=window.innerHeight*0.28,i;
for(i=0;i<s.length;i++){if(s[i].getBoundingClientRect().top<=line)hit=s[i]}
var a=hit?m[hit.id]:null;
if(a===cur)return;
if(cur)cur.removeAttribute('aria-current');
cur=a;
if(a)a.setAttribute('aria-current','true')}
function q(){if(queued)return;queued=true;requestAnimationFrame(u)}
addEventListener('scroll',q,{passive:true});
addEventListener('resize',q);
addEventListener('hashchange',q);
u()})();`.replace(/\n/g, '');
