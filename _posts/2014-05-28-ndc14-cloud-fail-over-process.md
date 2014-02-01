---
layout: post
title: 나이키 런더시티로 본 클라우드 서비스의 장애 복구 프로세스
tags: ndc14 cloud -pub
---

### 요약 ###

* 장애를 예측/계획하고 준비/복구하는 시스템을 구축한다.

### terminolgy ##

* `DR` [Disaster Recovery](http://en.wikipedia.org/wiki/Disaster_recovery)
* `BCP` [Business continuity planning](http://en.wikipedia.org/wiki/Business_continuity_planning)
* `RTO` [Recovery time objective](http://en.wikipedia.org/wiki/Recovery_time_objective)

### 사례 ###

* 대한항공 아프리카 이벤트
	* cloud에 대한 고민할 시간이 없어서 기존 개발자가 구축해놓은 것을 그대로 사용
	* cloud 가용성 테스트*(SLA 검토도 안 함)를* 하지 않은 상태에서 이벤트로 인한 접속 폭주
	* MCU 300~800명, 1분만에 service down
	* 당시 모 cloud 사의 문제로 인해 망했다.
		* network packet을 무시한다던가,
		* storage kernal error가 발생한다던가.

### 내용 ###
* cloud는 공유 자원
	* 좋은 혹은 나쁜 이웃과 자원을 공유
	* 나쁜 이웃을 만나면 infra resource를 빼앗길 수 있다.
	* 그래도 scale up/down이 간단하니 쓴다.
* [SLA](http://en.wikipedia.org/wiki/Service-level_agreement)
	* SLA uptime은 service 몇 분 down될지 정하는 것 [calculator](http://uptime.is/)
	* 99.9%는 8시간 45분/year 장애 허용
	* 99.995%는 1년에 26분/year 장애 허용
		* AWS/Azure는 99.95% (22분/month)
		* U-Cloud는 99.9% (44분/month)
		* 한국 데이터센터 IDC 99.982% (8분/month)
	* 단, 위 수치는 이론적/통계적 수치이므로 실 장애 시간은 더 길어질 수 있다.
* 따라서 **Cloud 서버는 장애를 고려해서 설계**해야 한다.
	* 복구의 골든타임을 확보해야 한다.
	* **계획적 장애 구간**을 수치화한다.
		* eg) `RTO` 1시간, `RPO` 30분
		* 데이터베이스 이중화
		* [hot spare](http://en.wikipedia.org/wiki/Hot_spare) *발표자료에서는 웜대기warm standby라고 함*: 교체 가용군 대기
		* [pilot light](https://aws.amazon.com/disaster-recovery/): 최후의 준비

### 설계 ###
* 모든 시스템을 한 곳에 모으지 않는다.
	* IDC를 여러 곳 사용한다.
	* KT Cloud를 쓴다면 일부는 T Cloud를 쓴다.
		* 해당 Cloud 장애 발생시 Active standby로 사용하거나,
		* 적어도 장애 공지를 띄우기 위해서라도 다른 cloud를 사용한다.
		* *(관련 서비스 구성도가 필요한데 추후 발표자료가 올라오면 연결하겠음)*
	* Data 부분을 VM과 망을 분리하여 구성, DDoS 공격을 받아도 다 죽지 않도록 구성한다.
* 복구를 위해,
	* VM, Storage를 망 분리로 구성 및 다중화하여 일부 장애가 발생해도 서비스가 가용하도록 하고,
	* 전 지점 장애 혹은 infra 장애 발생 시 이를 대체할 수 있는 warm standby를 준비해두고,
	* 최악의 상황을 대비해 cold backup도 준비해둔다.
	* 다중화된 시스템은 auto management 구성이 가능하므로 자동 복구가 되도록 구성하고,
	* warm standby 교체나 cold backup으로부터의 복구는 manual로 진행한다.
		* 교체나 복구 도중 기존 시스템이 자동 복구되면서 충돌하는 문제 등 다양한 상황에 대한 대처를 위해 그냥 손으로 한다.
		* 하지만 그런 장애가 발생했을 때에는 개발자가 쓰러져있는 경우가 많으니, 사전에 미리 **복구 script를 준비**해둔다.
* Virtual Network는 쓰지 않는 것이 좋다.
	* SLA 99.9%
	* 패킷을 씹어먹거나,
	* 동시에 열 수 있는 connection 개수의 제한이 심해서 자원이 금방 소모되고 조용히 서비스가 제공되지 않는다고 한다.
		* 기본 100~125만 session을 열 수 있는데,
		* SSL 등을 쓰면 약 30만 session을 사용할 수 있다고 하고, 이는 금방 소모된다고 한다. *(무슨 말인지는 잘 모르겠음)*

### 기타 ###

* vCPU의 성능을 믿지 말라.
	* vCPU는 hyper thread 등을 가상화해서 제공하는 것이기 때문에, 대충 spec에 비해 70% 정도의 성능을 발휘한다고 생각하는 것이 좋다.
	* 특히 나쁜 이웃과 함께할 경우 성능이 더 안 나온다.
	* 따라서 vCPU 성능 믿지 말고 널리 분산시키는 구조를 만들어야 한다.
* U-Cloud 등은 max-core를 선택해서 사용해라.
	* U-Cloud 시스템에 버그가 있어서 max-core를 사용하겠다고 서비스를 선택하면, 해당 물리 서버 하나를 통째로 내가 사용할 수 있게 된다.
* nodejs 쓰지 않는 것이 좋다.
	* memory limit가 심한데다가, leak이 있어서 긴 시간 운용이 어렵다. (v8이 잘 죽기도 잘 죽고)
	* cloud에서 돌릴 경우 vCPU 교착 등으로 성능이 66% 수준으로 떨어진다.
	* 만약 쓴다고 하면, 해당 VM의 core에 맞게 다시 빌드해서 사용하는 것이 좋다. (core에 맞게 최적화됨, visual-c나 intel-c로 v8 코드 빌드)
	* 아니면 문제가 발생하는 event가 있는데, 이런 것들을 회피해서 사용할 수 있도록 코드를 작성한다.

----------

* 내용이 많았는데 25분 세션이라 좀 아쉬웠다. 그나마 잘 아는 내용이 아니라서 제대로 다 못 적은 점도 좀 아쉬웠다.
* 정리한 내용이 길었지만 IDC 분산, 시스템 다중화, hot spare, cold backup 등의 단계별 복구 프로세스를 구성하고, 장애 발생 시 계획된 시간 내에 복구할 수 있는 시스템을 사전에 구축할 수 있도록 하자는 내용이다.