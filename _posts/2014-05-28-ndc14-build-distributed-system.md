---
layout: post
title: 분산서버 구축의 ABC - 대규모 분산 시스템을 구축하기 위한 실용적 예와 그 원칙들
tags: ndc14 distributed -pub
---

* [이호규](https://twitter.com/hoblue) / [발표자료](http://www.slideshare.net/HoGyuLee/ndc14-abc)

### 왜? ###

* 기획 요구가 높아짐에 따라 성능 문제가 야기됨
* 단일 머신으로 처리가 어려우니 분산으로 간다! network traffic, cpu, memory 등

### 어떻게? ###

* scale out
	* 기능 분리 서버
		* 상점 서버, 퀘스트 서버, ... 이런 식으로 분리
		* 예외 처리도 어렵고 transaction 구성도 어렵다. 그냥 이렇게 안 하는게 좋겠다.
	* 통합 독립 서버
		* role로 분리. 일반 서버, 던전 서버, ... 이런 식
		* 동시성 제어 및 유지보수가 용이하다.
* scale up
	* 성능보다 안정성을 위해 scale up을 사용 *(?)*
* database scale out
	* sharding
		* mapping table을 써서 shard 정보를 저장할 경우 caching 필수. 필요시 scale up
		* dynamic sharding은 db-instance가 추가되었을 경우 resharding이 어렵다.
	* transaction은 어떻게? 그냥 code로 다 구현해야 한다.
* cpu
	* pipeline 구조가 아닌 producer/consumer 구조로 구현을 해야 한다.
* memory
	* 한 머신에 2TB까지 사용할 수 있다. *(?)*
* IO
	* database
		* 일단 memory에 반영 후 db validation (즉, 후처리). 이 때 실패하면 해당 유저 disconnect하고 db 정합성 유지하도록 한다. *(?)*
	* network
		* chat을 분리해서 network 병목을 제거한다.
		* broadcast는 지불할 수 밖에 없는 비용이지만 grouping을 최적화해서 잘 하거나, 아니면 역시 network를 분리한다. *(?)*
* 지표
	* cpu는 packet queue 소모 시간을 본다.
	* network는 latency나 send queue 크기를 본다.
	* 병목 지점을 찾을 때에는 제일 부하를 많이 주는 로직을 단일 instance에서 실행해서 찾도록 한다.
* 서버 성능
	* 비동기 IO를 쓰고, polling보다는 event를 쓰고, 계산 값을 caching하는 등 최적화한다.
	* multi process와 multi thread 중 무엇을 사용하는 것이 좋을까?
		* switching 비용과 구현 비용 등을 고민하자.
	* multi thread를 쓰면 throughput이 좋지만 concurrent 버그가 발생하고 singleton에 접근하는 thread간의 경합 문제로 인해 제약(?)이 발생한댄다. *(?)*
	* 그래서 mo/mmo 서버가 아니면 multi io thread, single logic thread의 multi process 구조가 관리 개발이 편하니 좋댄다.

### 무엇을? ###

* fault tolerance
	* exception handling
		* always available (SEH)
			* 예외가 발생해도 SEH로 잘 잡아서 문제 상황만 적출하고 서비스는 가용하도록 한다.
		* graceful exception handling
			* 문제가 발생한 유저를 disconnect하는게 아니라 정중하게 로비로 모셔준다.
		* error trace (callstack + debug log)
			* tracing하기 쉽게 정보를 잘 모아서 남겨준다.
	* fail over
		* instance load
		* local db, memory db
		* db replication
* user trace
* server dashboard
* log
	* file보다 검색이 용이한 db를 쓰자.
	* 하나의 테이블에 데이터가 너무 많아지면 조회가 느려지니까 일일 로그는 일별 테이블을 만들어서 기록하자.
* monitor
	* redis 등의 memory db를 쓰자
* indicator
	* 중요한 로그는 서버에서 남기자, 근데 logging도 부담이 있으니까,
	* 게임 분석 지표는 클라이언트에서 logging을 하도록 하자. RabbitMQ 같은걸 쓰자.
* redis
	* push(notification) 기능을 사용해서 management를 위한 실시간 event를 전달하거나 상점 on/off같은 작업을 수행하자.

### deploy ###

* binary
	* united server
		* 모든 기능을 하나의 binary에 다 넣어두면 관리가 편하고 좋댄다.
	* one binary server
		* 위랑 뭐가 다른지는 잘 모르겠지만 아무튼 좋댄다. 근데 종합 설정 파일 같은게 나와서 복잡해질 수 있다고 한다.
* 일정 산출
	* 분산 시스템을 도입할 경우 유지보수 비용이 꽤 크기 때문에 개발:유지보수의 비율을 6:4 정도로 생각하고 일정을 잡자.
	* TDD를 애용하자.

----------

* **중간중간 무슨 소리인지 잘 이해가 안 되는 부분이 있었다.**
	* [이해가 안 되는 부분에 대해서는 발표자님께서 댓글로 친절히 설명을 해주셨다.](http://redirect.disqus.com/url?impression=e0a616e0-0aff-11e4-ae27-003048db5eee&forum=3026737&thread=2763589449&behavior=click&url=http%3A%2F%2Flacti.me%2F2014%2F05%2F28%2Fndc14-build-distributed-system%2F%23comment-1483795001%3AmwG_lKpQhTAuKYl4yhK6XJkCV2Y&post=1483795001&type=notification.post.moderator&event=email)
* chat의 경우 시야 범위의 broadcasting이 아닌 전체 전달 같은 경우엔 독립적 기능이니 community server를 따로 두어 io를 분산시키는 방법이 유효할지 모르겠는데, broadcasting의 network io를 분리한다는 발상은 좀 이상해보인다. 차라리 io를 전담하는 server를 둔다면 모르겠는데 어차피 분산 서버를 설계하는 상황에서 그게 무슨 큰 의미가 있는지 모르겠다.
* singleton 이야기는 그냥 concurrency control의 어려움을 이야기하려는 것 같은데 multi threading에서 singleton을 쓰려면 lock을 전제로 하거나 tls를 이용한 replica를 생각해야 할텐데 뭘 생각하는 건지 자세히 이야기를 안 해줘서 잘 모르겠다.
* 서비스 가용성 이야기하면서 계속 SEH 이야기를 하는데 heap corruption이 일어나거나 transaction 오류로 아이템 복사가 일어나도 SEH로 잡고 넘어갈 수 있다고 생각하는지 모르겠다.
* 일일 로그를 일일 테이블로 쪼개야한다는 것에서는 의견이 좀 분분한데, 요새 dbms는 내부적으로 partition을 제공해주기 때문에 굳이 사용자가 table을 직접 vertical partition을 해줘야 할 것 같지는 않다.