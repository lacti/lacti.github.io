---
layout: post
title: concurrency 알고리즘과 memory model
tags: concurrency memory study -pub
---

오늘 스터디에서 공부한 내용을 간략히 정리해보자.

원래 의도는,

* peterson's algorithm을 보고 여기서 비순차 실행이 일어날 때 발생하는 문제를 보고,
* memory consistency model의 memory order를 통해 문제를 어떻게 해결할 수 있는지 본 후에,
* lock free stack, lock free queue algorithm을 보고 문제를 파악한 후에 이를 해결하기 위해
* hazard pointer를 보려고 했는데

순서가 꼬였다-_-
아무튼 의도했던 순서로 정리하겠음

### peterson's algorithm ###

[Wiki: Peterson's algorithm](http://en.wikipedia.org/wiki/Peterson's_algorithm)

그냥 눈에 보이는대로 코드가 수행되면 문제가 발생하지 않는데, 비순차 실행에 의해 `flag[my_index] = true; turn = other_index;` 대입의 순서가 뒤집히면 critical section에 두 thread가 진입할 수 있는 문제가 발생한다.

```cpp
P0: turn = 1;
    flag[0] = true;
    while (flag[1] == true && turn == 1)
    {
        // busy wait
    }
    // critical section
    ...
    // end of critical section
    flag[0] = false;

P1: turn = 0;
    flag[1] = true;
    while (flag[0] == true && turn == 0)
    {
        // busy wait
    }
    // critical section
    ...
    // end of critical section
    flag[1] = false;
```

위 코드에 대해 아래와 같은 수행 흐름이 나오면 critical section이 보호되지 않는다.

| turn 	| flag_0 	| flag_1 	| 진행                       	|
|------	|--------	|--------	|----------------------------	|
| 0    	| false  	| false  	| 초기상태                    	|
| 1    	| false  	| false  	| p0: turn = 1               	|
| 0    	| false  	| false  	| p1: turn = 0               	|
| 0    	| false  	| true   	| p1: flag_1 = true // p1 진입 	|
| 0    	| true   	| true   	| p2: flag_0 = true // p0 진입 	|

### memory consistency model ###

비순차 실행에 의해 의존성이 없다고 판단되는 연산의 순서가 뒤집히는 것을 방지하기 위해 memory consistency model을 고민해야 한다.

* [WRL RR: Shared MEmory Consistency Models: A Tutorial](http://www.hpl.hp.com/techreports/Compaq-DEC/WRL-95-7.pdf)
* [Boost: Thread coordination using Boost.Atomic](http://www.boost.org/doc/libs/release/doc/html/atomic/thread_coordination.html)
* [Cppref: std::memory_order](http://en.cppreference.com/w/cpp/atomic/memory_order)

메모리 가시성 개념도 포함되어 있음. fence를 경계로 비순차 수행 가능 범위의 경계가 생김.  
인텔 x86-64 core를 쓰면 알아서 해주기 때문에 프로그래머가 신경 쓸 필요가 없다.

표준에서 설명하는 `memory_order_consume`, `memory_order_acquire`의 차이를 잘 모르겠음.
그리고 boost thread_coordination 문서의 마지막 예제 내용을 잘 모르겠음.

위 질문에 대한 [summerlight]님의 답변

> consume와 acquire 시멘틱에 대한 차이: DEC alpha에서 작업할거 아니면 그냥 acquire로 통일하면 됨.


### lock free algorithm과 aba problem ###

* lock free algorithm과 aba problem: [Non_Blocking_Algorithm.pdf](https://sites.google.com/site/doc4code/Non-Blocking%20Algorithm.pdf)
* obstruction-free, lock-free, wait-free 개념 구분
* CAS, CAS2(CASW), DCAS, TSX, RTM 대충
* aba problem이 잘 설명되어 있다. CAS를 node pointer로만 하기 때문에 그 주소값만 같으면 해당 주소가 가리키는 객체의 상태가 어떻게 변했어도 작업이 진행될 수 있는 것이 문제.  
  (즉 stack/queue를 나갔다가 다시 들어왔을 때, 해제되었다가 다시 할당되었는데 그 주소가 같을 때)

즉, 객체의 pointer 비교만으로는 객체의 상태 비교가 안되므로 count를 넣어서 객체의 버전관리(?)를 한다. CAS할 때마다 count를 증가시켜 이전과는 다른 객체라고 기록해주는 것. 여기서 CAS2가 쓰인다.

근데 InterlockedSList는 가난한 시절이라 CAS2 못 쓰고 memory alignment해서 남는 하위 4bit를 count로 쓴 것으로 알고 있다.  
(어설픈 기억으로는 MPMC concurrency queue를 lock free algorithm으로 만들 때 CAS 뭔가 잘못써서 aba problem 발생하면 해당 node가 다른 queue로 들어간 시점에도 뭔가 오동작하여 해당 queue까지 파괴했던 시나리오가 있었는데-_-; 자세히 기억이 안 난다.)

### [hazard pointer](http://www.drdobbs.com/lock-free-data-structures-with-hazard-po/184401890) ###

오늘 출력해간 논문보다 위 링크가 더 읽기 좋다. 완전 오늘 헛소리한 듯-_- 나중에 다시 자세히 읽어보고 정리하겠음

어쨌든 위 lock free algorithm 설명할 때 node를 언제 해제할 지는 굉장히 골치아픈 문제이다. 아직 어떤 thread가 그 node를 접근하고 있을 수 있는데 마음대로 delete했다가는 access violation이 발생하기 때문. 따라서 이를 안전하게 지울 수 있도록(safe memory reclamation) 여러 방법이 고안되었는데 그 중 하나가 hazard pointer이다.

### 환형큐의 concurrency 문제 ###

* [환형큐의 thread unsafety 문제]({% post_url 2012-02-23-thread-unsafety-problem-in-circular-queue %})

### [객체별 수행 동기화]({% post_url 2011-08-11-synchronize-function-execution-in-each-object %}) 글 코드의 문제 ###

[angdev]님의 문제 해결법

```cpp
mJobQueue.push(RequestJobPtr(new _RequestJobImpl(functor)));
while (!mJobQueue.empty() && InterlockedExchange(&mExclusiveFlag, 1) == 0) {
    for (RequestJobPtr job = nullptr; mJobQueue.try_pop(job); ) {
        (*job)();
        delete job;
    }
    InterlockedExchange(&mExclusiveFlag, 0);
}
```

### 과제 풀이법 ###

* 제빵사와 먹깨비 Actor가 주기적으로 공유자원 Basket을 감지하여 동작하는 방법
* 제빵사와 먹깨비와 바구니까지 모두 Actor이고 메시지를 잘 주고 받으면서 동기화
* 제빵사, 먹깨비 Actor가 모두 각자의 thread를 갖고 공유자원 Basket을 blocking-wait하면서 동작