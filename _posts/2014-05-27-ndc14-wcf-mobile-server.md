---
layout: post
title: WCF를 이용하여 쉽게 만드는 모바일 게임서버
tags: ndc14 c# server -pub
---

* WebServiceHost를 사용한 모바일 rest web api 서버를 만들어보자.
* msdn에 있을 법한 wcf 설명을 한참 함. [msdn 참고](http://msdn.microsoft.com/ko-kr/library/ms731190.aspx)
* 본인이 구현한 코드를 설명해주는 방식. 추후 발표자료와 함께 올린다고 함

* Contract
	* OperationContract로 web method를 노출
	* DataContract로 serialize/deserialize할 class를 정의
		* OnSerializing/ed, OnDeserializing/ed로 전후 hook 가능
* Binding
	* WebHttpBinding Http(s) 기반
	* WSDualHttpBinding은 양방향 가능
	* NetTcpBinding raw tcp로 통신 가능(?)
*  ServiceHost
	*  InstantContextMode, ConcurrencyMode
		* *single instance의 multiple concurrency를 사용하면서 동기화는 자료구조 수준으로 하는 대범함을 보임*
	*  WebServiceHost
		*  WebHttpBehavior, ServiceThrottlingBehavior, WebSecurity
*  ORM
	*  EntityFramework
		*  예전엔 성능이 별로였는데 요샌 좀 괜찮아졌다고 함


----------

* 그냥 msdn tutorial을 설명한 수준, 그나마도 기본 개념 설명에 많은 시간을 할애함.
* 예제 설명할 때 iis 안 쓰고 직접 service host 돌린 것은 이해하겠는데 콘솔이라서 뭐가 되네 안되네 하는 부분은 이해를 못 함.
* 예제의 worker thread 1023개, io thread 1000개인 이유를 모르겠음
* 관심 있으면 [self-host web api](http://www.asp.net/web-api/overview/hosting-aspnet-web-api/self-host-a-web-api)를 보는 것이 나을 듯 싶음.