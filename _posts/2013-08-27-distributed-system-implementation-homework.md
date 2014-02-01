---
layout: post
title: 분산 시스템 구현 과제 정리
tags: distributed study -pub
---

뭐라도 좋으니 간단한 분산 시스템을 구현해보자!  
단일 시스템과 비교하여 성능 혹은 가용성을 높이기 위해 분산 시스템을 설계해야 하는 것이니 일단 네트워크 프로그래밍은 필수이다. 효율을 높이기 위해 얼마나 작업을 잘 쪼개고 합치는가도 고민해야 하고, 장애가 발생했을 때 얼마나 복구될 수 있는지도 고민해야 한다.

### [angdev]님의 시스템 ###

* 풀씨 프로그래밍 대회 채점 서버를 nodejs/c++로 구현했다. aws 위에 서비스를 올렸으며 elb, ec2를 통해 서비스를 구성하였다.
* elb의 health check에 채점 서버의 service를 연결하여 해당 ec2 instance가 아닌 service의 상태를 점검하도록 하였다.
* 그리고 front-end에서 elb를 통해 채점 service에 code를 queueing하고, 각 service는 다시 dashboard-service에 자신의 상태를 기록한다.
* 일단 ec2 instance에 장애가 발생하면 queue 자체가 소멸되므로 이미 제출된 데이터가 삭제될 문제가 있는데, elb 대신 sqs를 써서 해결하였다.

- dashboard-service에 직접 http 통신으로 데이터를 주고 받는데 simpledb나 rds를 쓰는게 어떨까 생각한다.
- 뭐 어쨌든 분산, 장애 상황을 적절히 고려해서 잘 만든 시스템인듯. sqs 관련 내용은 철주가 게시판에 써주기로 했다.

### [LTeaRain]님의 시스템 ###

* 무난한 map/reduce 시스템. master/slave 구조이다.
* sequence에 대한 sum을 분산처리하는 시스템으로 seq를 적절히 round-robin으로 쪼개서 slave에게 전달, slave가 처리한 결과를 master가 받아서 취합하는 구조.

- 단, network 장애 등이 발생했을 때 해당 seq에 대해 다시 다른 slave를 배정하여 결과를 처리하도록 하는 등의 에러 복구에 대한 설계는 부족했지만, 그 자리에서 보완했다.  
  (요청 context 유지 후 해당 slave 장애 발생 시 다른 slave 배정)

### [kjkpoi]님의 시스템 ###

* DLBP double load balancer pattern
* 흥미로운 map/reduce 시스템. map을 하기 위한 load balancer와 reduce를 하기 위한  load balancer가 따로 있는 구조이다.
* 먼저 요청이 들어오면 map-lb에서 적절히 node를 분배해서 작업을 쪼개준다.
* 분배된 각 node들 중 하나가 작업이 완료되는 시점에 reduce-lb에서 적절히 reduce를 수행할 node를 찍고, 그 node가 reduce를 수행하게 된다. (나름 지연된 reduce node 선정)

- 굳이 lb를 2개 두지 않고, 작업이 끝난 node가 master-lb에 completion signal을 보내면 reduce node를 mapping하는 식으로 설계해도 될 것 같다.
- 그리고 역시 장애 대응 로직이 없는데 이는 context 잘 유지해서 처리해주면 되겠다.

### aws가 제안하는 기본적인 분산 시스템 ###

* elb - ec2 instances
* cloud watch - auto scaling
* elb로 request를 적절히 ec2 instance에게 넘긴다.
* 이 때 cloud watch로 metrics를 분석해 필요할 경우 auto scaling에게 요청하여 scale in/out을 수행한다.

### big table ###

* 동일한 데이터를 담는 cluster를 묶어 cluster군을 형성, read replica 같은 느낌으로 처리 속도를 향상시킨다.
* chubby service가 어느 위치에 데이터를 읽고 쓸지 관리하는데 이 service가 죽으면 곤란해지니까 대충 5대를 묶어서 구성한다.
* 5개의 chubby 중 chubby leader와 chubby follower가 생기고, leader가 죽으면 남은 chubby들이 투표해서 다음 leader를 뽑는 식으로 장애에 대응할 수 있게 구성됨

### 정리 ###

분산 시스템을 구성함에 있어 잘 쪼개고 잘 합치는 것 만큼이나 장애 상황이 발생했을 때 어떻게 복구할 것인지에 대한 고려도 중요하다. 따라서 이미 구현된 분산 시스템의 설계를 보고 그들이 어떻게 해당 문제들을 해결하였는지 살펴보자. aws같은 cloud service 내의 component나 nosql의 설계를 보면 좋겠다.

잘 쪼개고 합치는 부분에 대해서는 hadoop의 mapreduce와 impala를 비교해보면 좋겠다. 그리고 replica 등을 통해 성능을 향상할 경우 발생하는 버전 충돌 문제에 대해서도 공부하면 좋겠다.