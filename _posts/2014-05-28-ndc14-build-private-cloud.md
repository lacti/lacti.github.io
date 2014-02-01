---
layout: post
title: 모바일 게임서비스를 위한 사설 클라우드 구축/운영 분투기
tags: ndc14 cloud -pub
---

{% oembed http://www.slideshare.net/reinkim/ndc14 %}

* [김진욱](http://rein.kr/blog/)

### 요약 ###

* 직접 머신 infra 구축 + os/vm/open source (수정/튜닝)해서 private cloud 구축
* 문제, 대응, 문제, 대응, 문제, 대응, ...
* 근데 windows로 넘어가니 또 신세계: 문제, 대응, 문제, 대응, 문제, 대응, ...

### 내용 ###

* Build Private Cloud for Mobile Game
	* x86 + switch + cables + power
	* linux kvm, openstack, puppet, haproxy, nginx, uwsgi, dnsmasq, dpkg, fabric, ...
* Problem domain
	* application, vm, os, virtualize sw, infrastructure
	* infrastructure problems: cable 불량, sensor 불량, power 불량, IPMI 불량, ...
* setup automation
	* PXE, debian-installer, puppet, bash-scripts
		* PXE는 (변형된) DHCP가 필요한데 IP가 중복되면서 debian-installer가 실패하는 문제가 발생
		* debian-installer는 udeb package도 사용하는데 deb만 mirroring해서 망, 그리고 머신 종속적인 package는 관리 주의
		* puppet는 signing 문제, 머신 type별 설정 분리 문제, package 의존성에 의한 문제, 모듈 로딩 순서 문제 등
	* 그리고 뭔가 package repository 문제
* resource management
	* ulimit, sysctrl, nofile
	* network parameter: conntrack
		* 제대로 설정을 안하면, connection이 안 맺어지거나 안 끊어지는 문제가 발생해서 서비스가 조용히 안 되는 경우가 있음
	* OOM killer
		* linux의 메모리 할당은 낙관적인데, 메모리가 막 할당되었다가 kill 당할 수 있으니 주의
	* Disk elevator
	* Scale out
		* 보통 web server. 접속 몰리면 load balancer를 사용
		* HAProxy를 쓴다. 1vCPU + 1GB memory 주면 10K~100K http req/sec 정도는 처리
		* stat 보고 tuning해서 쓴다.
		* 만약 허용량 초과하면 HAProxy를 여러 개 쓰고 DNS RoundRobin을 앞단에 붙여준다.
		* 근데 DNS 갱신이 느리니까 추가될 때마다 갱신하는 것보다는 미리 IP 할당 후 등록해두고 사용한다. (expiration 줄이는 것보다 이게 더 빠르다.)
* Live with FOSS
	* OpenStack 버그 많고 (의외로) 기능이 별로 없다.
	* HAProxy의 한계
		* 단일 thread/process 사용.
			* 하지만 2core 줘서 core 하나는 HA가, 나머지 하나는 kernel이 쓰게하면 처리 성능이 좋아진다.
		* SSL terminator 지원을 안한다.
		* soft restart 후 glitch가 발생한다.
	* 보안 취약점으로 인해 패치를 할 경우, host 수준의 패치일 경우 물리 머신을 재시작해야 하는 고통이 있다.
	* OpenStack + KVM으로 windows를 구동할 경우 문제가 많다.
		* linux 기반으로 만든 툴을 python으로 만들어서 windows에도 배포
		* windows의 puppet는 유료, secureshell도 유료, LDAP은 복잡(?)
* Monitoring
	* 뭐가 문제인지 파악하기 위해 필요함. 장애인가 점검인가?
	* 외부 서비스 장애인가?
		* 카카오톡 게임 서비스 장애?
		* billing 서버 응답 지연?
		* 통신사망 장애?
	* Alarm
		* email: noti가 잘 안된다.
		* SMS
		* 전화 걸기: 비싸다.
* Summary
	* *(발표 자료 참고바랍니다.)*

----------

* 역시 25분 발표라서 시간이 너무 부족함.
* 정말 분투기임. 구축자의 애환이 느껴졌다.
* 양이 너무 많아서 다 정리하기는 어려웠고, 그냥 발표자료 보는 것을 추천.