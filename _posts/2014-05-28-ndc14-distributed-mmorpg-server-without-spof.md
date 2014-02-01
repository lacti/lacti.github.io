---
layout: post
title: 프로젝트K 서버 아키텍처 - SPOF 없는 분산 MMORPG 서버
tags: ndc14 python distributed -pub
---

{% oembed http://www.slideshare.net/sublee/spof-mmorpg %}

* [이흥섭](http://subl.ee/)

### 요약 ###

* gevent를 믿고 ØMQ를 통해 객체/서버 시야 개념을 바탕으로 서버간 정보 동기화를 한다.
* 정보가 동기화되었으니 서버가 다중화되었다고 치고, 서버 말고는 다 튼튼하니 SPOF가 없다. (ELB 튼튼, couchbase 튼튼)
* 하지만 무중단 패치나 서버 다운으로 인한 client의 server connection 이전은 고민 중.

### 목표 ###

* 실시간 동기화되는, 영속성 있고, 심리스인, 단일 세계를 구현해보자.
* 높은 가용성, 높은 가용률, 높은 신축성이 목표
* **따라서 [SPOF](http://en.wikipedia.org/wiki/Single_point_of_failure)는 허용하지 않는다.**

### 구현 ###

* python
	* open source를 통해 생산성을 높임.
	* 연산이 느리고 multi threading이 미흡하지만, 대부분은 io bound 작업(inter-server communication)이기 때문에 필요한 부분(serialize, deserialize)만 c로 작성하면 되겠다.
	* gevent
		* sync/async io, coroutine, monkey patch, microthread
* inter-server communication
	* broker 없이 전 서버를 그냥 다 연결했다.
	* 하지만 어떤 서버들과 연결해야 하는지 주소록은 필요하니까 주소 교환용 broker는 하나 뒀다.
	* [ØMQ](http://zeromq.org/)를 사용하여 서버간 통신
		* round robin 방식을 사용하면 아무 node에게나 message를 전달한다.
		* pub/sub 방식을 사용하면 해당 channel을 구독한 대상에게만 message를 전달한다.
			* subscriber 정보가 publisher에게 동기화되어, publisher는 해당 channel을 구독한 subscriber가 있을 때에만 정보를 보내고, 없으면 정보를 보내지 않는다.
* mmorpg 분산 처리
	* 영속성은 db로, 휘발성은 memory로
	* rdbms는 분산 어렵고 느리고 schema 변경이 어렵기 때문에 분산 db로는 couchbase를 사용했다.
		* 무중단 확장/축소, 부분 장애 허용, no schema, 응답 속도 빠름
		* 응답 속도의 경우 memory 반영 후 바로 응답할지, io 반영 완료 후 응답할지를 설정할 수 있다.
		* 내용 검색은 지원하지 않는데 ElasticSearch나 N1QL을 쓸 수는 있다. 하지만 엄청 느리니 live에서 쓰면 안 됨.
* GameServer
	* 거리와 상호 작용은 반비례. 보통 가까이 있는 대상과 상호작용을 한다.
	* 단일 서버로 가는 것이 목표인데 서버 다중화를 해야 하니 서버끼리 열심히 동기화를 해야 한다.
	* 서버간 통신 비용이 발생하는데 모바일 클라이언트와의 통신 비용에 비하면 상대적으로 싸니까 괜찮다(?)
	* 시야를 grid로 나누어서 각 grid를 pub/sub channel로 사용하여 서버간 동기화를 한다.
		* 서버 시야는 서버 내 존재하는 객체 시야의 합이다.
		* 서버 간의 시야가 겹치는 영역에 대해서만, 즉 grid의 sub channel에 대해서만 객체를 동기화한다.
	* 객체가 무작위로 서버에 퍼지면 서버 시야가 넓어지므로 동기화 비용이 커진다.
		* 로그인 서버를 통해 사용자를 적절하게 분리한다.
		* 이 경우 사용자들의 이동으로 인해 서버 시야가 넓어질 수 있는데,
			* 이 게임은 모바일 게임이니까 한 번 맺은 세션에서 그렇게 많이 돌아다니지는 않을 것이다. 따라서 문제는 적을 것으로 가정한다.
* object interaction
	* 서버 시야가 겹치는 영역에 대해, 동일한 객체가 여러 서버에 존재할 수 있게 된다.
		* 이 때 진짜 객체를 real이라 하고 나머지들을 ghost라고 하자.
		* ghost들은 정보를 동기화해서 가지고는 있어 accessor를 통해 정보 조회가 바로 가능하지만, mutator를 수행 시 진짜 객체를 가진 서버를 대상으로 rpc를 요청하게 된다.
		* real과 ghost는 잘 추상화해서 구분하지 않고 쓸 수 있도록 코딩해놨다.

### 정리 ###
* system topology *(발표자료 참고바람)*
	* User -&gt; ELB -&gt; LoginServer
	* User -&gt; GameServers... -&gt; Couchbase
	* LoginServer  GameServers...
* 이 구조에서 ELB, Couchbase가 튼튼하고 GameServer가 다중화되어있으니 이 시스템은 SPOF가 없다.
	* *(LoginServer나 server address broker는 장애가 발생해도 시스템은 돌아가니 SPOF로 치지 않는 것 같다)*
* 무중단 확장/축소는 가능한데 무중단 배포 서버 구성은 아직 안 되었다.
* 특정 GameServer 재시작 시 클라이언트 연결을 이전하는 문제도 아직 해결이 안 되었다.

----------

* SPOF가 없다는 것으로 어그로를 많이 끌었다. 결국 GameServer를 다중화해서 SPOF를 없앤다는 이야긴데 구축 영역에서 이야기를 해보면 별로 효용이 없을 것 같다.
	* (성능 문제는 차치하더라도) 저 시스템은 서버간 통신에 의한 동기화를 기본으로 삼고 있기 때문에, 해당 로직에 문제가 있거나 기능이 추가될 경우 전체 시스템 중단이 불가피하다.
	* 무중단 서비스를 위해서는 서버 다중화 뿐만 아니라 IDC 다중화도 해야 한다. *(cloud 구축 발표 참고)* 하지만 여러 다른 IDC 간의 서버 동기화를 위와 같은 잦은 방식으로 진행한다면 제 시간 내에 동기화가 되는 것을 기대하기 어려울 뿐만 아니라 통신 비용으로 인해 운영 비용 크리를 맞을 것이다.
	* 그리고 특정 서버 장애 발생 시 해당 client의 연결을 얼마나 graceful하게 다른 서버로 이전해줄 것이냐에 대한 문제도 있는데 이것에 대한 언급이 없었다. 해당 서버가 죽었으니 그 서버에서 아직 동기화되지 못한 정보가 있을텐데 그것은 어떻게 넘겨줄 것이며, 정말 운 없게 transaction이라도 진행 중이었다면 그것을 어떻게 복원해줄 것인지에 대한 고민도 필요하다.
* 시야 개념을 통한 동기화 개념은 꽤 재밌고, python이라는 언어적 특성을 통한 proxy(ghost) 구성도 재미있기는 하다.
	* 하지만 ØMQ에 의한 동기화가 허용 시간 내에 일어남을 보장해줄 지 모르겠고,
	* 그로 인해 뭔가 logic 문제나 transaction 구성이 실패할 경우 proxy 밑단에 숨겨져있는 문제를 잘 발견할 수 있을지 모르겠다.
* 모바일이니까 괜찮아요, 라는 괜찮은 수준을 좀 정량적으로 제시하고, 그에 대한 stress test 결과가 있었으면 좋을 것 같다.
* 뭐 어쨌든 시도나 발상은 재밌다고 생각한다.
