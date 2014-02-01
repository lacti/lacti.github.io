---
layout: post
title: websocket, webRTC
tags: web
---

* [websocket.org](http://www.websocket.org/)
* [Wiki: WebSocket](http://en.wikipedia.org/wiki/WebSocket)
* [RFC6455: The WebSocket Protocol](http://tools.ietf.org/html/rfc6455)
* [W3C TR: The WebSocket API](http://www.w3.org/TR/websockets/)

WebSocket 표준이 확정되지 않은 줄 알았는데 2011년 10월에 확정되었다. 그리고 W3C API는 2012년 9월에 CR단계가 되었나보다. 그럼 이제 써도 되나?

IE는 10부터 지원한다-_-

* [MSDN: The WebSocket API](http://msdn.microsoft.com/en-us/library/ie/hh673567.aspx)


약간 다르지만 WebRTC라는 것도 있다.

* [webrtc.org](http://www.webrtc.org/)
* [Wiki: WebRTC](http://en.wikipedia.org/wiki/WebRTC)

대충 위키에 써있는 설명을 가져오면 다음과 같다.

> browser-to-browser applications for voice calling, video chat, and P2P file sharing without plugins.

*browser-to-browser*, 즉 peer connection이 가능하다.

* [WebRTC: Plugin-free realtime communication](http://io13webrtc.appspot.com/)
* [RTCDataChannel Example](http://www.simpl.info/rtcdatachannel/)

DataChannel API가 존재하며, WebSocket에 비해 좋은 점이 있다고 소개하고 있다. 지금은 표준화 작업 진행 중이다.