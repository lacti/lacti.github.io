(window.webpackJsonp=window.webpackJsonp||[]).push([[5],{162:function(n,e,t){"use strict";t.r(e),t.d(e,"query",function(){return u});var r=t(166),a=t(12),i=(t(0),t(172)),o=t(169),c=t(175),d=t(177),l=t(176),s=Object(r.a)("div",{target:"e2e8kon0"})({name:"acwcvw",styles:"margin-bottom:1rem;"});e.default=function(n){var e=n.data.markdownRemark,t=e.html,r=e.fields.date,u=e.frontmatter,b=u.title,g=u.tags;return Object(a.d)(c.a,null,Object(a.d)(i.a,null,Object(a.d)(o.a,null,Object(a.d)("h1",null,b),Object(a.d)(s,null,Object(a.d)(l.a,{date:r}),g.map(function(n){return Object(a.d)(d.a,{key:n,tag:n})})),Object(a.d)("div",{dangerouslySetInnerHTML:{__html:t}}))))};var u="2585844565"},167:function(n,e,t){"use strict";t.d(e,"b",function(){return r}),t.d(e,"d",function(){return a}),t.d(e,"a",function(){return i}),t.d(e,"f",function(){return o}),t.d(e,"c",function(){return c}),t.d(e,"e",function(){return d});var r={brand:"#481380",link:"#742dd2",lilac:"#9d7cbf",accent:"#ffb238",success:"#37b635",warning:"#ec1818",ui:{bright:"#e0d6eb",light:"#f5f3f7",whisper:"#fbfafc"},code:"#fcf6f0",gray:{dark:"hsla(270, 17.119554496%, 0%, 0.92)",copy:"hsla(270, 15.797828016000002%, 0%, 0.88)",calm:"rgba(0, 0, 0, 0.54)"},white:"#fff",black:"#000"},a={sansSerif:'"Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", Arial, sans-serif',serif:'Georgia, "Times New Roman", Times, serif',monospace:'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace, monospace'},i={xs:0,sm:576,md:768,lg:992,xl:1200},o={md:720,lg:960,xl:1140},c={fontSize:{regular:16,large:18},headingSizes:{h1:1.8,h2:1.5,h3:1.35,h4:1.2},lineHeight:{regular:1.65,heading:1.2},containerPadding:1.5},d={header:72}},168:function(n,e,t){"use strict";t.d(e,"b",function(){return b});var r=t(12),a=t(0),i=t.n(a),o=t(5),c=t.n(o),d=t(43),l=t.n(d);t.d(e,"a",function(){return l.a});t(171);var s=i.a.createContext({});function u(n){var e=n.staticQueryData,t=n.data,a=n.query,o=n.render,c=t?t.data:e[a]&&e[a].data;return Object(r.d)(i.a.Fragment,null,c&&o(c),!c&&Object(r.d)("div",null,"Loading (StaticQuery)"))}var b=function(n){var e=n.data,t=n.query,a=n.render,i=n.children;return Object(r.d)(s.Consumer,null,function(n){return Object(r.d)(u,{data:e,query:t,render:a||i,staticQueryData:n})})};b.propTypes={data:c.a.object,query:c.a.string.isRequired,render:c.a.func,children:c.a.func}},169:function(n,e,t){"use strict";var r=t(166),a=t(12),i=(t(0),t(167)),o=t(170),c=Object(r.a)("div",{target:"ei8rjbq0"})("position:relative;margin-left:auto;margin-right:auto;width:auto;max-width:",Object(o.a)(i.f.lg),"em;");e.a=function(n){var e=n.children,t=n.className;return Object(a.d)(c,{className:t},e)}},170:function(n,e,t){"use strict";t.d(e,"a",function(){return a});var r=t(167),a=function(n){return n/r.c.fontSize.regular}},171:function(n,e,t){var r;n.exports=(r=t(174))&&r.default||r},172:function(n,e,t){"use strict";var r=t(166),a=t(12),i=(t(0),t(167)),o=Object(r.a)("div",{target:"e1eg7n7x0"})("display:block;flex:1;position:relative;padding:",i.c.containerPadding,"rem;margin-bottom:3rem;");e.a=function(n){var e=n.children,t=n.className;return Object(a.d)(o,{className:t},e)}},173:function(n){n.exports={data:{site:{siteMetadata:{title:"Lacti's Archive",description:"All about I learned"}}}}},174:function(n,e,t){"use strict";t.r(e);t(67);var r=t(0),a=t.n(r),i=t(5),o=t.n(i),c=t(68),d=function(n){var e=n.location,t=n.pageResources;return t?a.a.createElement(c.a,Object.assign({location:e,pageResources:t},t.json)):null};d.propTypes={location:o.a.shape({pathname:o.a.string.isRequired}).isRequired},e.default=d},175:function(n,e,t){"use strict";var r=t(12),a=t(173),i=t(0),o=t(178),c=t.n(o),d=t(168),l=(t(179),t(180),t(167)),s=t(170),u='\n  @import url("https://fonts.googleapis.com/earlyaccess/notosanskr.css");\n\n  html {\n    box-sizing: border-box;\n  }\n\n  *,\n  *::before,\n  *::after {\n    box-sizing: inherit;\n  }\n\n  html {\n    font-size: '+l.c.fontSize.regular+"px !important;\n    line-height: "+l.c.lineHeight.regular+" !important;\n  }\n\n  body {\n    width: 100%;\n    overflow-x: hidden;\n    overflow-y: scroll;\n    font-family: "+l.d.sansSerif+";\n    color: "+l.b.black+";\n    background-color: "+l.b.white+";\n    -webkit-text-size-adjust: 100%;\n    -ms-text-size-adjust: 100%;\n  }\n\n  a {\n    color: "+l.b.link+";\n    text-decoration: none;\n    font-weight: 500;\n\n    &:hover,\n    &:focus {\n      text-decoration: underline;\n    }\n  }\n\n  img {\n    max-width: 100%;\n    object-fit: contain;\n    position: relative;\n  }\n\n  figure {\n    margin: 2rem 0;\n  }\n\n  figcaption {\n    font-size: 80%;\n  }\n\n  table {\n    width: 100%;\n    margin-bottom: 1rem;\n    border: 1px solid "+l.b.ui.light+";\n    font-size: 85%;\n    border-collapse: collapse;\n  }\n\n  td,\n  th {\n    padding: .25rem .5rem;\n    border: 1px solid "+l.b.ui.light+";\n  }\n\n  th {\n    text-align: left;\n  }\n\n  tbody {\n    tr {\n      &:nth-of-type(odd) {\n        td {\n          background-color: "+l.b.ui.whisper+";\n        }\n        tr {\n          background-color: "+l.b.ui.whisper+";\n        }\n      }\n    }\n  }\n\n  h1, h2, h3, h4, h5, h6 {\n    margin-top: 1.414rem;\n    margin-bottom: .5rem;\n    color: "+l.b.black+";\n    font-weight: 600;\n    line-height: "+l.c.lineHeight.heading+";\n    text-rendering: optimizeLegibility;\n  }\n\n  h1 {\n    margin-top: 0;\n    font-size: "+l.c.headingSizes.h1+"rem;\n  }\n\n  h2 {\n    font-size: "+l.c.headingSizes.h2+"rem;\n  }\n\n  h3 {\n    font-size: "+l.c.headingSizes.h3+"rem;\n  }\n\n  h4, h5, h6 {\n    font-size: "+l.c.headingSizes.h4+"rem;\n  }\n\n  p {\n    margin-top: 0;\n    margin-bottom: 1rem;\n  }\n\n  strong {\n    color: "+l.b.black+";\n  }\n\n  ul,\n  ol,\n  dl {\n    margin-top: 0;\n    margin-bottom: 1rem;\n  }\n\n  dt {\n    font-weight: bold;\n  }\n\n  dd {\n    margin-bottom: .5rem;\n  }\n\n  hr {\n    position: relative;\n    margin: 1.5rem 0;\n    border: 0;\n    border-top: 1px solid "+l.b.ui.light+";\n  }\n\n  blockquote {\n    margin: .8rem 0;\n    padding: .5rem 1rem;\n    border-left: .25rem solid "+l.b.ui.light+";\n    color: "+l.b.gray.calm+";\n\n    p {\n      &:last-child {\n        margin-bottom: 0;\n      }\n    }\n\n    @media (min-width: "+Object(s.a)(l.a.md)+"em) {\n      padding-right: 5rem;\n      padding-left: 1.25rem;\n    }\n  }\n\n  code {\n    font-family: "+l.d.monospace+";\n  }\n\n  code:not(.vscode-highlight-code) {\n    background-color: rgba(27,31,35,.05);\n    border-radius: 3px;\n    font-size: 95%;\n    margin: 0;\n    padding: .2em .4em;\n  }\n\n  code.vscode-highlight-code {\n    white-space: pre;\n    word-break: normal;\n    font-size: 90%;\n  }\n",b=t(166),g=t(181),m=t(169),f=Object(b.a)("header",{target:"e1tqqkg0"})("height:",l.e.header,"px;padding:0 ",l.c.containerPadding,"rem;background-color:",l.b.brand,";color:",Object(g.a)(.5,l.b.white),";"),h=Object(b.a)(m.a,{target:"e1tqqkg1"})({name:"voneje",styles:"display:flex;flex-direction:row;align-items:center;height:100%;"}),p=Object(b.a)(d.a,{target:"e1tqqkg2"})("color:",l.b.white,";font-size:1.8rem;font-weight:600;&:hover,&:focus{text-decoration:none;}"),j=function(n){var e=n.title;return Object(r.d)(f,null,Object(r.d)(h,null,Object(r.d)(p,{to:"/"},e)))},v=Object(b.a)("div",{target:"exus2xv0"})({name:"zf0iqh",styles:"display:flex;flex-direction:column;min-height:100vh;"}),y=function(n){var e=n.children,t=n.className;return Object(r.d)(i.Fragment,null,Object(r.d)(r.a,{styles:function(){return Object(r.c)(u)}}),Object(r.d)(v,{className:t},e))},O=Object(b.a)("main",{target:"e5vn29h0"})({name:"b95f0i",styles:"display:flex;flex-direction:column;flex:1;"}),x=function(n){var e=n.children,t=n.className;return Object(r.d)(O,{className:t},e)};e.a=function(n){var e=n.children;return Object(r.d)(d.b,{query:"991718019",render:function(n){return Object(r.d)(y,null,Object(r.d)(c.a,{title:n.site.siteMetadata.title,meta:[{name:"description",content:n.site.siteMetadata.description},{name:"keywords",content:n.site.siteMetadata.keywords}]}),Object(r.d)(j,{title:n.site.siteMetadata.title}),Object(r.d)(x,null,e))},data:a})}},176:function(n,e,t){"use strict";var r=t(166),a=t(12),i=(t(0),Object(r.a)("span",{target:"etnz4u60"})({name:"lbx3g2",styles:"display:inline-block;font-size:1rem;font-weight:500;display:inline-block;margin:4px;"}));e.a=function(n){var e=n.date;return Object(a.d)(i,null,e)}},177:function(n,e,t){"use strict";var r=t(166),a=t(12),i=(t(0),t(168)),o=function(n){switch(n){case"c++":return"cplusplus";case"c#":return"csharp";default:return n}},c=Object(r.a)("div",{target:"e15u2a1u0"})({name:"9zyr4y",styles:"display:inline-block;padding:4px 8px;margin:0px 4px;border-radius:8px;background-color:#f1f1f1;"});e.a=function(n){var e=n.tag;return Object(a.d)(c,null,Object(a.d)(i.a,{to:"/tag/"+o(e)+"/"},e))}}}]);
//# sourceMappingURL=component---src-templates-page-tsx-b0cdcd02aa32beb6663a.js.map