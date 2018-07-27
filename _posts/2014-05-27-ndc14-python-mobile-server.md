---
layout: post
title: 파이썬과 친구들 - 체계적이고 빠른 모바일 게임 서버 개발을 위한 최적의 도구
tags: ndc14 python server
---

* 모바일은 connectivity가 불안정하다.
* 고로 WebServer 형태로 감
* `microframework`: `bottle`, `Flask`

### IO ###

* event-driven io, callback chaining
* `gevent`
	* coroutine, nonblocking io로 monkey patch
	* *근데 mysql python은 monkey patch가 안된다*

### scaling ###

* single thread multiple process
* `gunicon`, `circus`, `supervisor`

### database ###

* nosql
	* `couchbase` auto sharding, zero configuration
	* `mongodb` logging
* rdbms
	* `sqlalchemy`

### cache ###

* `redis` login session 등

### worker ###

* `celery`
	* 별도 process, 서버와 io 통신
	* broker(redis, RabbitMQ)를 통한 sharing
	* decorator 붙이면 rpc로 만들어줌


### logging ###

* `logbook`
	* implements custom handler

### deployment ###

* dvcs
* repository hook api
* `fabric`

----------

초반에 파이썬 문법을 설명해서 좀 당황했는데, 어떤 개념과 어떤 라이브러리를 썼는지 정도는 다 열거를 해서 그나마 다행히었다고 생각한 세션이었음.