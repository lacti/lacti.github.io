---
layout: post
title: Rx와 Functional Reactive Programming으로 고성능 서버 어플리케이션 만들기
tags: ndc14 server -pub
---

{% oembed http://www.slideshare.net/jongwookkim/ndc14-rx-functional-reactive-programming %}

* [김종욱](http://jongwook.kim/home)

### 요약 ###

* 대세는 병렬처리, 이를 Reactive functional programming으로 풀어보자. ~~근데 functional 이야기 안 함~~
* Reactive가 왜 나왔는지 알아보자, 그러면서 MONAD 잠깐 이야기
* 그러면서 Rx.NET 조금 소개 ~~고성능 이야기 안 함~~

### 내용 ###

* ControlFlow
	* Turning machine, Intel Arch
	* Imperative Programming
* DataFlow
	* 병렬처리
	* Compiler 발전으로 최적화 잘 해줌
	* The Future of Programming
		* Actor Model
		* Massively Parallel model
* Reactive Programming
	* DataFlow 설명을 위한 Excel cell 예시 A + B -&gt; C
	* 독립적 작업 단위 + 데이터 흐름 예시) Gate 조합
	* 기존 명령형 언어는 병렬처리가 어렵다?
		* 선언적, DataFlow, Functional Programming, Reactive
* Reactive Manifesto
	* Responsible
	* Scalable
	* **Event-driven**
	* Resilient
* 시간 이야기
	* 뭔가 이야기를 많이 했지만 결국 **switch 비용을 줄이자**
	* tasklet이 작고 빨라야 함.
* event driven
	* 사실상 microthread 이야기를 함
	* 관련 framework 이야기를 하면서 callback hell 같은 문제를 언급
*  MONAD
	*  `INPUT => M<OUTPUT>`
	*  MONAD = Unit + FlatMap
	*  Maybe, Try, Iterable, Future

| - 		| 하나 		| 다수 		|
|-------|-----------|-----------|
| 동기	| Try 		| Iterable 	|
| 비동기	| Future 	| Rx 		|

* Reactive
	* Rx = Observable + LINQ + Scheduler
		* Observable = Reactive Stream
	* Iterable (pull) -&gt; Observable (push) [duality]
	* Map: Synchronous Continuation
	* FlatMap: Asynchronous Continuation
	* 기타 operation들 소개
* LE Platform
	* TCP -&amp;gt; Dispatch -&amp;gt; [Handlers...] -&amp;gt; Database
* 기타
	* http://reactive-streams.org
	* java: play, akka, reactor
	* http://reactconf.org
	* coursera principles of Reactive programming
* debugging
	* data flow 기반 분석
	* data flow를 database처럼 기록(?)해서 추적
* 기타 청중 건의
	* async lock이나 async enumerable을 쓰는 것도 고려해보세요.

----------

* 발표 내용은 잘 정리되어 흥미로웠지만 정작 Reactive Programming으로 어떻게 고성능 서버를 구현하는 지에 대한 언급이 미흡
	* 병렬 처리에 있어서 stateless한 functional programming이 유리한건 사실이나 이게 reactive programming과 어떻게 연결된다는 지에 대한 설명이 부족
	* event driven으로 microthread나 async io를 설명하는건 좋고, 이게 sync io나 blocking에 비해 성능이 좋은 것은 맞는데 reactive programming과의 연결성이 모호
	* reactive programming으로 소개된 rx.net은 표현력이 좋은 것이지 성능적 이점을 얻기 위한 것이 아님
	* lineage eternal이 저걸 어떻게 사용했는지에 대한 부분을 너무 대충 다루고 넘어감
* 재미는 있었으나 내용면에서 좀 아쉬운 발표였음
