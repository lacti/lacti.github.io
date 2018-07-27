---
layout: post
title: 라이브 상황에서 윈도우 서버 개발자가 겪은 좌충우돌 Redis 적용 경험담
tags: ndc14 server
---

### 요약 ###

* linux 모르는 windows 개발자가 linux에 redis깔고 lua script 돌렸습니다.

### 내용 ###

* CSO에 실시간 랭킹 구현 요청에 따라 redis를 도입
	* db는 어렵고 sql 못하니 유지보수 못하고
	* 신규 서버 만드려니 구현 부담이 너무 큼
* 근데 windows redis는 unofficial임
* 따라서 ubuntu 깔고 redis 설치
	* sentinel 써서 master/slave 구축을 해 failover하도록 구성해야 했는데 못 함
* client library로 hiredis를 썼는데 linux library라서 porting을 할까 하다가 그냥 windows redis에 붙어있는 library 씀
* 최신 버전을 깔고 싶은데 package repo에 버전이 옛날 것.
	* PPA라는 좋은 물건이 있어요!
* cron 설명, pscp 설명
* rdb, aof로 백업해서 windows에 둠
	* rdb는 redis desktop manager로 열어보면 좋음
* live 운영 실수로 redis, rdb 모두 날림. aof로 복구함
* redis lua script 설명
	* 외부 client library로 접근하는 것보다 내부 script가 훨씬 빠름
	* evalsha는 return이 없어서 script 성공/실패 여부를 알기가 어려움. 따라서 special key를 만들어 결과를 저장하고 보는 식으로 사용
	* redis nil은 lua false와 같다
	* lua 함수 제한이 있으니 _G 보고 판단해서 사용
	* lua bind도 설명
* redis pub/sub 설명

----------

* ...