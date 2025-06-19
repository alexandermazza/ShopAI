import{r as n,j as t}from"./index-BALFTjq4.js";import{c as u,d as y,e as f,f as x,_ as S,M as j,L as w,O as g,S as k}from"./components-C1LH-GfK.js";/**
 * @remix-run/react v2.15.3
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */let a="positions";function v({getKey:o,...c}){let{isSpaMode:l}=u(),r=y(),p=f();x({getKey:o,storageKey:a});let h=n.useMemo(()=>{if(!o)return null;let e=o(r,p);return e!==r.key?e:null},[]);if(l)return null;let d=((e,m)=>{if(!window.history.state||!window.history.state.key){let s=Math.random().toString(32).slice(2);window.history.replaceState({key:s},"")}try{let i=JSON.parse(sessionStorage.getItem(e)||"{}")[m||window.history.state.key];typeof i=="number"&&window.scrollTo(0,i)}catch(s){console.error(s),sessionStorage.removeItem(e)}}).toString();return n.createElement("script",S({},c,{suppressHydrationWarning:!0,dangerouslySetInnerHTML:{__html:`(${d})(${JSON.stringify(a)}, ${JSON.stringify(h)})`}}))}const b=()=>[{title:"ShopAI App"},{name:"viewport",content:"width=device-width,initial-scale=1"}];function E(){return t.jsxs("html",{children:[t.jsxs("head",{children:[t.jsx("meta",{charSet:"utf-8"}),t.jsx("meta",{name:"viewport",content:"width=device-width,initial-scale=1"}),t.jsx("meta",{httpEquiv:"Content-Security-Policy",content:"frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com"}),t.jsx("link",{rel:"preconnect",href:"https://cdn.shopify.com/"}),t.jsx("link",{rel:"stylesheet",href:"https://cdn.shopify.com/static/fonts/inter/v4/styles.css"}),t.jsx("script",{src:"https://cdn.shopify.com/shopifycloud/app-bridge/app-bridge.js",defer:!0}),t.jsx(j,{}),t.jsx(w,{})]}),t.jsxs("body",{children:[t.jsx(g,{}),t.jsx(v,{}),t.jsx(k,{})]})]})}export{E as default,b as meta};
