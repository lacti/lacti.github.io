(window.webpackJsonp=window.webpackJsonp||[]).push([[7],{174:function(e,t,a){"use strict";a.r(t),a.d(t,"pageQuery",function(){return d});var n=a(0),r=a.n(n),i=a(11),s=a.n(i),c=a(178),l=a(185),o=a(182),u=a(188),p=function(e){var t=e.pageContext,a=e.data,n=t.tag,i=a.allMarkdownRemark,s=i.edges,p=i.totalCount,d=p+" post"+(1===p?"":"s")+' tagged with "'+n+'"';return r.a.createElement(l.a,null,r.a.createElement(o.a,{title:d}),r.a.createElement("h3",null,d),r.a.createElement("ul",{className:"post-list"},s.map(function(e){var t=e.node,a=t.excerpt,n=t.fields,i=n.path,s=n.date,c=t.frontmatter,l=c.title,o=c.tags;return r.a.createElement(u.a,{key:i,excerpt:a,path:i,date:s,title:l,tags:o})})),r.a.createElement(c.a,{to:"/tags"},"All tags"))};p.propTypes={pageContext:s.a.shape({tag:s.a.string.isRequired}),data:s.a.shape({allMarkdownRemark:s.a.shape({totalCount:s.a.number.isRequired,edges:s.a.arrayOf(s.a.shape({node:s.a.shape({excerpt:s.a.string.isRequired,frontmatter:s.a.shape({title:s.a.string.isRequired,tags:s.a.arrayOf(s.a.string).isRequired}),fields:s.a.shape({path:s.a.string.isRequired,date:s.a.string.isRequired})})}).isRequired)})})},t.default=p;var d="1394491507"},178:function(e,t,a){"use strict";var n=a(0),r=a.n(n),i=a(11),s=a.n(i),c=a(58),l=a.n(c);a.d(t,"a",function(){return l.a});a(179),r.a.createContext({});s.a.object,s.a.string.isRequired,s.a.func,s.a.func},179:function(e,t,a){var n;e.exports=(n=a(180))&&n.default||n},180:function(e,t,a){"use strict";a.r(t);a(20);var n=a(0),r=a.n(n),i=a(11),s=a.n(i),c=a(82),l=function(e){var t=e.location,a=e.pageResources;return a?r.a.createElement(c.a,Object.assign({location:t,pageResources:a},a.json)):null};l.propTypes={location:s.a.shape({pathname:s.a.string.isRequired}).isRequired},t.default=l},181:function(e){e.exports={data:{site:{siteMetadata:{title:"Lacti's Archive"}}}}},182:function(e,t,a){"use strict";var n=a(183),r=a(0),i=a.n(r),s=a(11),c=a.n(s),l=a(187),o=a.n(l);function u(e){var t=e.description,a=e.lang,r=e.meta,s=e.title,c=n.data.site,l=t||c.siteMetadata.description;return i.a.createElement(o.a,{htmlAttributes:{lang:a},title:s,titleTemplate:"%s | "+c.siteMetadata.title,meta:[{name:"description",content:l},{property:"og:title",content:s},{property:"og:description",content:l},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"},{name:"twitter:creator",content:c.siteMetadata.author},{name:"twitter:title",content:s},{name:"twitter:description",content:l}].concat(r)})}u.defaultProps={lang:"en",meta:[],description:""},u.propTypes={description:c.a.string,lang:c.a.string,meta:c.a.arrayOf(c.a.object),title:c.a.string.isRequired},t.a=u},183:function(e){e.exports={data:{site:{siteMetadata:{title:"Lacti's Archive",description:"Development Archiving.",author:"jaeyoung.choi"}}}}},184:function(e,t){e.exports.asTagPath=function(e){switch(e){case"c++":return"cplusplus";case"c#":return"csharp";default:return e}}},185:function(e,t,a){"use strict";var n=a(181),r=a(0),i=a.n(r),s=a(11),c=a.n(s),l=a(178),o=function(e){var t=e.siteTitle;return i.a.createElement("header",{style:{background:"rebeccapurple",marginBottom:"1.45rem"}},i.a.createElement("div",{style:{margin:"0 auto",maxWidth:960,padding:"1.45rem 1.0875rem"}},i.a.createElement("h1",{style:{margin:0}},i.a.createElement(l.a,{to:"/",style:{color:"white",textDecoration:"none"}},t))))};o.propTypes={siteTitle:c.a.string},o.defaultProps={siteTitle:""};var u=o,p=(a(186),function(e){var t=e.title,a=e.children,r=n.data;return i.a.createElement(i.a.Fragment,null,i.a.createElement(u,{siteTitle:t||r.site.siteMetadata.title}),i.a.createElement("div",{style:{margin:"0 auto",maxWidth:960,padding:"0px 1.0875rem 1.45rem",paddingTop:0}},i.a.createElement("main",null,a),i.a.createElement("footer",null,"© ",(new Date).getFullYear(),", Built with"," ",i.a.createElement("a",{href:"https://www.gatsbyjs.org"},"Gatsby"))))});p.propTypes={children:c.a.node.isRequired,title:c.a.string};t.a=p},188:function(e,t,a){"use strict";var n=a(0),r=a.n(n),i=a(11),s=a.n(i),c=a(178),l=a(184),o=function(e){var t=e.excerpt,a=e.path,n=e.date,i=e.title,s=e.tags;return r.a.createElement("li",{className:"post-item"},r.a.createElement(c.a,{to:a,title:t},r.a.createElement("h1",null,i)),r.a.createElement("div",null,r.a.createElement("h2",{className:"post-item-date"},n),s.map(function(e){return r.a.createElement("div",{key:a+"_"+e,className:"chip"},r.a.createElement(c.a,{to:"/tags/"+Object(l.asTagPath)(e)},e))})),r.a.createElement("p",null,t))};o.propTypes={excerpt:s.a.string.isRequired,path:s.a.string.isRequired,date:s.a.string.isRequired,title:s.a.string.isRequired,tags:s.a.arrayOf(s.a.string).isRequired},t.a=o}}]);
//# sourceMappingURL=component---src-templates-tags-js-495fa52aad6a26c98563.js.map