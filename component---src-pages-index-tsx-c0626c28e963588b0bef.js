(window.webpackJsonp=window.webpackJsonp||[]).push([[4],{165:function(n,e,t){"use strict";t.r(e),t.d(e,"pageQuery",function(){return l});var r=t(12),a=(t(0),t(172)),i=t(169),o=t(175),c=t(182);e.default=function(n){var e=n.data.allMarkdownRemark.edges;return Object(r.d)(o.a,null,Object(r.d)(a.a,null,Object(r.d)(i.a,null,Object(r.d)(c.a,{items:e.filter(function(n){return!n.node.frontmatter.permalink}).map(function(n){var e=n.node,t=e.excerpt,r=e.fields,a=r.slug,i=r.date,o=e.frontmatter;return{excerpt:t,slug:a,date:i,title:o.title,tags:o.tags}})}))))};var l="1286454787"},167:function(n,e,t){"use strict";t.d(e,"b",function(){return r}),t.d(e,"d",function(){return a}),t.d(e,"a",function(){return i}),t.d(e,"f",function(){return o}),t.d(e,"c",function(){return c}),t.d(e,"e",function(){return l});var r={brand:"#481380",link:"#742dd2",lilac:"#9d7cbf",accent:"#ffb238",success:"#37b635",warning:"#ec1818",ui:{bright:"#e0d6eb",light:"#f5f3f7",whisper:"#fbfafc"},code:"#fcf6f0",gray:{dark:"hsla(270, 17.119554496%, 0%, 0.92)",copy:"hsla(270, 15.797828016000002%, 0%, 0.88)",calm:"rgba(0, 0, 0, 0.54)"},white:"#fff",black:"#000"},a={sansSerif:'"Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", Arial, sans-serif',serif:'Georgia, "Times New Roman", Times, serif',monospace:'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace, monospace'},i={xs:0,sm:576,md:768,lg:992,xl:1200},o={md:720,lg:960,xl:1140},c={fontSize:{regular:16,large:18},headingSizes:{h1:1.8,h2:1.5,h3:1.35,h4:1.2},lineHeight:{regular:1.65,heading:1.2},containerPadding:1.5},l={header:72}},168:function(n,e,t){"use strict";t.d(e,"b",function(){return g});var r=t(12),a=t(0),i=t.n(a),o=t(5),c=t.n(o),l=t(43),d=t.n(l);t.d(e,"a",function(){return d.a});t(171);var s=i.a.createContext({});function u(n){var e=n.staticQueryData,t=n.data,a=n.query,o=n.render,c=t?t.data:e[a]&&e[a].data;return Object(r.d)(i.a.Fragment,null,c&&o(c),!c&&Object(r.d)("div",null,"Loading (StaticQuery)"))}var g=function(n){var e=n.data,t=n.query,a=n.render,i=n.children;return Object(r.d)(s.Consumer,null,function(n){return Object(r.d)(u,{data:e,query:t,render:a||i,staticQueryData:n})})};g.propTypes={data:c.a.object,query:c.a.string.isRequired,render:c.a.func,children:c.a.func}},169:function(n,e,t){"use strict";var r=t(166),a=t(12),i=(t(0),t(167)),o=t(170),c=Object(r.a)("div",{target:"ei8rjbq0"})("position:relative;margin-left:auto;margin-right:auto;width:auto;max-width:",Object(o.a)(i.f.lg),"em;");e.a=function(n){var e=n.children,t=n.className;return Object(a.d)(c,{className:t},e)}},170:function(n,e,t){"use strict";t.d(e,"a",function(){return a});var r=t(167),a=function(n){return n/r.c.fontSize.regular}},171:function(n,e,t){var r;n.exports=(r=t(174))&&r.default||r},172:function(n,e,t){"use strict";var r=t(166),a=t(12),i=(t(0),t(167)),o=Object(r.a)("div",{target:"e1eg7n7x0"})("display:block;flex:1;position:relative;padding:",i.c.containerPadding,"rem;margin-bottom:3rem;");e.a=function(n){var e=n.children,t=n.className;return Object(a.d)(o,{className:t},e)}},173:function(n){n.exports={data:{site:{siteMetadata:{title:"Lacti's Archive",description:"All about I learned",keywords:"lacti, c, c++, c#, java, javascript, typescript",image:"https://lacti.github.io/background.jpg"}}}}},174:function(n,e,t){"use strict";t.r(e);t(67);var r=t(0),a=t.n(r),i=t(5),o=t.n(i),c=t(68),l=function(n){var e=n.location,t=n.pageResources;return t?a.a.createElement(c.a,Object.assign({location:e,pageResources:t},t.json)):null};l.propTypes={location:o.a.shape({pathname:o.a.string.isRequired}).isRequired},e.default=l},175:function(n,e,t){"use strict";var r=t(12),a=t(173),i=t(0),o=t(178),c=t.n(o),l=t(168),d=(t(179),t(180),t(167)),s=t(170),u='\n  @import url("https://fonts.googleapis.com/earlyaccess/notosanskr.css");\n\n  html {\n    box-sizing: border-box;\n  }\n\n  *,\n  *::before,\n  *::after {\n    box-sizing: inherit;\n  }\n\n  html {\n    font-size: '+d.c.fontSize.regular+"px !important;\n    line-height: "+d.c.lineHeight.regular+" !important;\n  }\n\n  body {\n    width: 100%;\n    overflow-x: hidden;\n    overflow-y: scroll;\n    font-family: "+d.d.sansSerif+";\n    color: "+d.b.black+";\n    background-color: "+d.b.white+";\n    -webkit-text-size-adjust: 100%;\n    -ms-text-size-adjust: 100%;\n  }\n\n  a {\n    color: "+d.b.link+";\n    text-decoration: none;\n    font-weight: 500;\n\n    &:hover,\n    &:focus {\n      text-decoration: underline;\n    }\n  }\n\n  img {\n    max-width: 100%;\n    object-fit: contain;\n    position: relative;\n  }\n\n  figure {\n    margin: 2rem 0;\n  }\n\n  figcaption {\n    font-size: 80%;\n  }\n\n  table {\n    width: 100%;\n    margin-bottom: 1rem;\n    border: 1px solid "+d.b.ui.light+";\n    font-size: 85%;\n    border-collapse: collapse;\n  }\n\n  td,\n  th {\n    padding: .25rem .5rem;\n    border: 1px solid "+d.b.ui.light+";\n  }\n\n  th {\n    text-align: left;\n  }\n\n  tbody {\n    tr {\n      &:nth-of-type(odd) {\n        td {\n          background-color: "+d.b.ui.whisper+";\n        }\n        tr {\n          background-color: "+d.b.ui.whisper+";\n        }\n      }\n    }\n  }\n\n  h1, h2, h3, h4, h5, h6 {\n    margin-top: 1.414rem;\n    margin-bottom: .5rem;\n    color: "+d.b.black+";\n    font-weight: 600;\n    line-height: "+d.c.lineHeight.heading+";\n    text-rendering: optimizeLegibility;\n  }\n\n  h1 {\n    margin-top: 0;\n    font-size: "+d.c.headingSizes.h1+"rem;\n  }\n\n  h2 {\n    font-size: "+d.c.headingSizes.h2+"rem;\n  }\n\n  h3 {\n    font-size: "+d.c.headingSizes.h3+"rem;\n  }\n\n  h4, h5, h6 {\n    font-size: "+d.c.headingSizes.h4+"rem;\n  }\n\n  p {\n    margin-top: 0;\n    margin-bottom: 1rem;\n  }\n\n  strong {\n    color: "+d.b.black+";\n  }\n\n  ul,\n  ol,\n  dl {\n    margin-top: 0;\n    margin-bottom: 1rem;\n  }\n\n  dt {\n    font-weight: bold;\n  }\n\n  dd {\n    margin-bottom: .5rem;\n  }\n\n  hr {\n    position: relative;\n    margin: 1.5rem 0;\n    border: 0;\n    border-top: 1px solid "+d.b.ui.light+";\n  }\n\n  blockquote {\n    margin: .8rem 0;\n    padding: .5rem 1rem;\n    border-left: .25rem solid "+d.b.ui.light+";\n    color: "+d.b.gray.calm+";\n\n    p {\n      &:last-child {\n        margin-bottom: 0;\n      }\n    }\n\n    @media (min-width: "+Object(s.a)(d.a.md)+"em) {\n      padding-right: 5rem;\n      padding-left: 1.25rem;\n    }\n  }\n\n  code {\n    font-family: "+d.d.monospace+";\n  }\n\n  code:not(.vscode-highlight-code) {\n    background-color: rgba(27,31,35,.05);\n    border-radius: 3px;\n    font-size: 95%;\n    margin: 0;\n    padding: .2em .4em;\n  }\n\n  code.vscode-highlight-code {\n    white-space: pre;\n    word-break: normal;\n    font-size: 90%;\n  }\n",g=t(166),m=t(181),b=t(169),f=Object(g.a)("header",{target:"e1tqqkg0"})("height:",d.e.header,"px;padding:0 ",d.c.containerPadding,"rem;background-color:",d.b.brand,";color:",Object(m.a)(.5,d.b.white),";"),h=Object(g.a)(b.a,{target:"e1tqqkg1"})({name:"voneje",styles:"display:flex;flex-direction:row;align-items:center;height:100%;"}),p=Object(g.a)(l.a,{target:"e1tqqkg2"})("color:",d.b.white,";font-size:1.8rem;font-weight:600;&:hover,&:focus{text-decoration:none;}"),j=function(n){var e=n.title;return Object(r.d)(f,null,Object(r.d)(h,null,Object(r.d)(p,{to:"/"},e)))},y=Object(g.a)("div",{target:"exus2xv0"})({name:"zf0iqh",styles:"display:flex;flex-direction:column;min-height:100vh;"}),v=function(n){var e=n.children,t=n.className;return Object(r.d)(i.Fragment,null,Object(r.d)(r.a,{styles:function(){return Object(r.c)(u)}}),Object(r.d)(y,{className:t},e))},O=Object(g.a)("main",{target:"e5vn29h0"})({name:"b95f0i",styles:"display:flex;flex-direction:column;flex:1;"}),x=function(n){var e=n.children,t=n.className;return Object(r.d)(O,{className:t},e)};e.a=function(n){return Object(r.d)(l.b,{query:"1802208211",render:function(e){var t=e.site.siteMetadata,a=function(n,e){return{title:n.title||e.title,description:n.description||e.description,keywords:n.tags&&n.tags.length>0?n.tags.join(", "):e.keywords,image:e.image}}(n,t),i=a.title,o=a.description,l=a.keywords,d=a.image;return Object(r.d)(v,null,Object(r.d)(c.a,{title:i,meta:[{name:"description",content:o},{name:"keywords",content:l},{name:"og:title",content:i},{name:"og:type",content:"article"},{name:"og:description",content:o},{name:"og:image",content:d}]}),Object(r.d)(j,{title:i}),Object(r.d)(x,null,n.children))},data:a})}},176:function(n,e,t){"use strict";var r=t(166),a=t(12),i=(t(0),Object(r.a)("span",{target:"etnz4u60"})({name:"lbx3g2",styles:"display:inline-block;font-size:1rem;font-weight:500;display:inline-block;margin:4px;"}));e.a=function(n){var e=n.date;return Object(a.d)(i,null,e)}},177:function(n,e,t){"use strict";var r=t(166),a=t(12),i=(t(0),t(168)),o=function(n){switch(n){case"c++":return"cplusplus";case"c#":return"csharp";default:return n}},c=Object(r.a)("div",{target:"e15u2a1u0"})({name:"9zyr4y",styles:"display:inline-block;padding:4px 8px;margin:0px 4px;border-radius:8px;background-color:#f1f1f1;"});e.a=function(n){var e=n.tag;return Object(a.d)(c,null,Object(a.d)(i.a,{to:"/tag/"+o(e)+"/"},e))}},182:function(n,e,t){"use strict";var r=t(44),a=t.n(r),i=t(166),o=t(12),c=(t(0),t(168)),l=t(177),d=t(176),s=Object(i.a)("li",{target:"e185itio0"})({name:"8fkoyy",styles:"margin-bottom:2rem;"}),u=Object(i.a)("h1",{target:"e185itio1"})({name:"1wbykfx",styles:'font-size:1.8rem;margin-bottom:6px;color:blue;["& a"]:{text-decoration:none;}'}),g=Object(i.a)("div",{target:"e185itio2"})({name:"acwcvw",styles:"margin-bottom:1rem;"}),m=Object(i.a)("p",{target:"e185itio3"})({name:"1hg9omi",styles:"word-break:break-all;"}),b=function(n){var e=n.excerpt,t=n.slug,r=n.title,a=n.date,i=n.tags;return Object(o.d)(s,null,Object(o.d)(u,null,Object(o.d)(c.a,{to:t,title:e},r)),Object(o.d)(g,null,Object(o.d)(d.a,{date:a}),i.map(function(n){return Object(o.d)(l.a,{key:n,tag:n})})),Object(o.d)(m,null,e))},f=Object(i.a)("ul",{target:"e1twdn4g0"})({name:"1iruc8t",styles:"list-style:none;margin:0;padding:0;"});e.a=function(n){var e=n.items;return Object(o.d)(f,null,e.map(function(n){return Object(o.d)(b,a()({key:n.slug},n))}))}}}]);
//# sourceMappingURL=component---src-pages-index-tsx-c0626c28e963588b0bef.js.map