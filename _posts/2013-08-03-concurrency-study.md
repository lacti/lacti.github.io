---
layout: post
title: concurrency 스터디
tags: concurrency study -pub
---

오늘 스터디에서 공부한 내용을 간략히 정리해보자.

* [Wiki: ABA problem](http://en.wikipedia.org/wiki/ABA_problem)
* [Simple, Fast, and Practical Non-Blocking and Blocking Concurrent Queue Algorithms](http://www.cs.rochester.edu/u/scott/papers/1996_PODC_queues.pdf)
* [context switching과 simultaneously 실행]({% post_url 2011-08-02-context-switching-and-simultaneously %})
* [환형큐의 thread unsafety 문제]({% post_url 2012-02-23-thread-unsafety-problem-in-circular-queue %})


### volatile/interlocked operation/memory barrier ###

* [volatile 과 interlocked operation]({% post_url 2011-08-02-volatile-interlocked-operation %})
* [summerlight: volatile과 메모리 배리어](http://summerlight-textcube.blogspot.kr/2009/11/volatile%EA%B3%BC-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EB%B0%B0%EB%A6%AC%EC%96%B4.html)

### intrusive/non-intrusive ###

* [Linux kernel LinkedList](http://www.makelinux.net/ldd3/chp-11-sect-5)
* [Boost: Boost.Intrusive](http://www.boost.org/doc/libs/release/doc/html/intrusive.html)
* [Boost: Intrusive and non-intrusive containers](http://www.boost.org/doc/libs/release/doc/html/intrusive/intrusive_vs_nontrusive.html)

### InterlockedSList ###

* [Interlocked Singly Linked Lists]({% post_url 2011-08-03-interlocked-singly-linked-lists %})

### Actor model ###

각 actor 객체에 접근하는 thread는 반드시 하나임을 보장함. context switching 비용을 줄이기 위해 thread 개수를 제한하지만 많은 actor를 다루기 위해 객체별 수행 동기화 기법을 사용한다.

* [Wiki: Actor model](http://en.wikipedia.org/wiki/Actor_model)
* [객체별 함수 수행 동기화]({% post_url 2011-08-11-synchronize-function-execution-in-each-object %})

### out of order execution ###

* 컴파일러의 명령어 재배치 수준이 아닌 cpu 내부의 비순차 실행
* 비순차 실행을 통해 최대 수행 시간의 절감 효과를 얻음
* 하드웨어적 한계로 비순차 실행 명령어 window를 유지 (reservation stations), 그 내부에서 각 operand 준비 완료가 되면 연산 수행
* operand 준비 완료 통지 연산량 감소를 port grouping, 결과 순서를 보장해주기 위해 rob를 사용
* [Wiki: Reservation stations](http://en.wikipedia.org/wiki/Reservation_stations)

### memory consistency model ###

우리가 작성한 대로 수행을 보장해준다면(Sequentially-consistent ordering) 프로그램의 흐름을 이해하기가 쉽지만 최적화 가능성이 줄어듬. 이를 완화(relaxed)해주어서 최적화가 잘 되게 해보자. 그런데 intel x86-64는 그런 것 신경 안 써줘도 빠르게 돌아감*([summerlight]님 수정)*

* [WRL-RR: Shared Memory Consistency Models: A Tutorial](http://www.hpl.hp.com/techreports/Compaq-DEC/WRL-95-7.pdf)

c++11에 memory order로 추가됨.

* [Cppref: std::memory_order](http://en.cppreference.com/w/cpp/atomic/memory_order)

### c++ threading facilities ###

* [Wiki: c++ threading facilities](http://en.wikipedia.org/wiki/C%2B%2B11#Threading_facilities)

표준에서 지원하기는 하지만 표준 라이브러리가 어떻게 구현되어있는지 보고 괜찮은지를 판단한 후 사용하자.

* [async, future, promise in c++](http://www.slideshare.net/lactrious/synchronizing-concurrent-threads)

### sync/async programming ###

아무튼 async가 흐름 따라가기가 어렵다.

* [asynchronous programming 과 async, await]({% post_url 2012-03-18-asynchronous-programming-and-async-await %})

### c++11의 lambda ###

* [Visual C++10과 C++0x](http://ogoons.tistory.com/69)

### thread safe한 singleton ###

* [PoolC: C++ 싱글턴 (summerlight)](http://board.poolc.org/generation03/512)

근데 intel x86-64에서는 memory barrier 안 쳐줘도 문제가 없다-_-; 하지만 c++11부터는 함수 내 static 변수를 반환하는 것만으로도 대충 thread-safe한 singleton이 구현 가능해졌다.

* [Stackoverflow: Is local static variable initialization thread-safe in C++11](http://stackoverflow.com/questions/8102125/is-local-static-variable-initialization-thread-safe-in-c11)
* [Stackoverflow: c++ threadsafe static constructor](http://stackoverflow.com/questions/2280630/c-threadsafe-static-constructor)

### 기타 windows via c/c++ 내용 ###

CreateThread, SSDT, Kernel object, CriticalSection, ...

### lock ###

* CAS (InterlockedCompareExchange 사용) 로 쉽게 구현할 수 있다.
* reader/writer (shared/exclusive) lock을 사용할 수 있지만 fairness를 잘 고민해야한다.
* 그냥 lock/unlock 부르지 말고 raii 잘 써서 쓰자.

### 과제 해법 ###

* lock 사용
* interlocked-operation 사용
* counter(actor)에 대해 message passing 사용