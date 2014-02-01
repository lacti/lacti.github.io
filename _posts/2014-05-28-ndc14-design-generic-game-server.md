---
layout: post
title: 범용 게임 서버 프레임워크 디자인 및 테크닉
tags: ndc14 design server -pub
---

{% oembed http://www.slideshare.net/iFunFactory/20140524-ndc-sharing %}

* [문대경](http://ifunfactory.com/)

### 요약 ###

* 가정/목표를 정하고 할 수 있는 것/없는 것을 구분하여 시스템을 설계한다.
* Comm=JSON, Mgmt=RestAPI, Obj=Json CodeGen/STM, Dist=RPC인 GameServer를 설계한다.

### System Design ##

* System = interface + Architecture
* Architecture = functional list + 그것들의 배치/연동
* design decision은 trade off가 있다.
* design goal을 세우고 잘 지키도록 한다.
	* 목표를 정의하고, 가정/필수/포기를 결정한다.
	* 제공하는 것, 할 수 있는 것, 할 수 없는 것을 결정한다.
* 이를 바탕으로 구현하는 것은 system builder라고 한다. (기술에 집중하는 사람)
* system designer의 성장 방향
	* 코드 한 줄 - 함수 - 모듈 - 서비스 - 사람(?) 을 설계하는 방향으로 성장
* 정리하면, **가정 하에 뭐가 되고 안 되는지**를 결정 (trade off를 잘 고려)

### Generic GameServer Framework Design ##

* 가정: 뭐가 올라가는 지 모름
* 목표: **Flexibility** (임의의 게임을 올려야 하니까), **Scalability** (확장성이 좋아야함), **minimum-performance** (상대적으로 포기한다)
* **client-server message format**
	* standard format은 http, udp, json, xml... usability, inefficiency
	* custom format은 TLV, length를 기록한 tcp, ... efficiency, manageability
	* overhead, traffic profiling, encryption 등을 고려
		* eg) MTU 보다 message 크기가 크냐 작냐
	* 본 설계에서는 flexibility 측면에서 **JSON을 선택**함
		* traffic, encryption, serialize, deserialize overhead가 있다.
* **Management**
	* push-based *(중요 유저 행동 로그 남길 때 사용)*
		* db, file, logging
		* Management가 GameServer에게 control 명령을 내리면, GameServer는 Management에게 data를 push함.
		* GameServer는 구현이 편한데(?) Management에서 data를 읽을 수 있도록 맞추는게 힘듬(?)
	* pull-based *(서버 상태 및 통계 데이터 조회 시 사용)*
		* SOAP, REST
		* Management가 GameServer에세 control 명령 내리고 그 결과를 바로 받아옴
		* 불특정 외부 시스템 연동이 용이
	* 따라서, **management에는 REST를 선택**함.
* **GameObject**
	* class hierarchy를 framework에서 다 강제해서 준다면,
		* 잘 맞으면 좋고 안 맞으면 유연성이 없으니 힘들다. 근데 잘 맞을 일이 없다.
		* 특히 c++처럼 상속 관계에 대한 customize가 어려운 곳이면 정말 좋지 않다.
	* 개발자가 다 만들어 쓰도록 한다면,
		* framework에서 할 일이 없네.
	* 따라서 중도책으로, **meta language를 사용하여 code generation**을 하겠다.
		* json으로 object를 정의하고 codegen으로 object code를 생성한다.
	* 갑자기 deadlock 이야기. *(아마도 GameObject를 만들었으니 상태 변경에 대한 concurrency control을 하고 싶은 듯)*
		* deadlock을 피하기 위해서 변경 작업은 cancellable해야 한다. 그리고 rollback해야 한다.
		* optimistic concurrency control을 사용하기 위해 journaling &amp; rollback을 수행한다. *(STM 구현한다는 소리를 하고 싶은 것 같다)*
* **분산 서버**
	* partitioned server를 만들어서 존/채널 단위로 분리하면 쉽다.
	* 하지만 **rpc 기반의 shared world**를 만들 것이다.
		* rpc 기반의 remote lock까지 만들어서 사용
		* object가 서버 별로 분산되어 있으므로,
			* object를 lookup하기 위한 Directory Service를 만들고,
			* 어느 서버에 object가 있는지 찾으면 해당 서버로 rpc 날려서 lock 걸고
			* 상태 변경을 한다.
			* 이 때 lock 건 서버가 사망하면 골치 아프니 적당히 timeout 걸어서 해결
			* *(분산 transaction은 어떻게 구현하실 건가요? 라는 질문이 있었는데 답변이 길어진다고 넘어감)*
		* 위처럼 하면, 특정 object를 소유하지 않은 서버가 접근을 많이하는 부담이 있을 수 있다.
		* 이를 해결하기 위해 object migration을 한다.
			* 참조를 가장 많이하는 서버에세 object 관리를 넘기는 방법
			* reference counting을 해서 처리한댄다.
	* zoo keeper 같은 것을 쓸 수도 있는데 느려서 안 쓴댄다.
* 그래서 정리해보면,
	* client-server message format은 JSON,
	* management를 위해 RestAPI 제공,
	* game-object는 json으로부터 code generation을 하고, STM을 구현해 동시성을 제어,
	* 분산 서버는 rpc 기반으로 구축한다.

----------

* Q&amp;A 때 성능으로 질문이 들어오긴 했는데, *목표에서 이미 성능은 포기했다*로 답변함.
* 마지막 분산 시스템 설계 부분에서는 *왜 저렇게까지 해야 하나*라는 생각이 들 정도. 저럴거면 그냥 object sharing server로 redis같은 것을 쓰는게 낫지 않나?