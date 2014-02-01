---
layout: post
title: concurrency pattern과 분산 시스템 스터디
tags: distributed concurrency study -pub
---

Concurrency Pattern부터 Distributed System까지! 근데 대충함 [...]

### [Concurrency pattern](http://en.wikipedia.org/wiki/Concurrency_pattern) ###

대충 정리해보자.

* [Wiki: Active Object](http://en.wikipedia.org/wiki/Active_Object)
	* Active Object는 Actor Model 구현하면서 써봤다. asynchronous method invocation과 request scheduling이 관건이다. 지난 글에서는 함수 요청을 functor로 만들어서 요청을 queueing하고, 처음 진입하는 thread가 해당 queue의 모든 작업을 처리하는 식으로 구현하였다.
* [Wiki: Double checked locking pattern](http://en.wikipedia.org/wiki/Double_checked_locking_pattern)
	* 보호해야 하는 특정 구간에 대해 단순 if 문으로 조건을 검사할 경우 여러 thread가 동시에 진입하여 concurrency problem이 발생할 수 있다. 따라서 해당 if문도 lock으로 보호해야 하는데, if 문 내의 코드가 정말 드물게 실행되는 경우 매번 lock을 걸고 if 문을 검사하는 것은 뭔가 아까워서, 일단 lock 없이 if 문으로 대충 검사해보고, lock 걸고, 다시 if 문으로 검사하여 안전하게 코드를 수행시키는 방법이다.
		* 물론 memory order 문제가 있을 수 있다. 이와 관련해서는 [PoolC: C++ 싱글톤](http://board.poolc.org/generation03/512) 문서의 `ThreadSafe::create()` 함수를 보면 된다.
	* 보통 singleton 객체의 초기화를 위해 많이 사용되는 방법이다.
	* c++11에서는 function 내의 static variable의 초기화에 대해 하나의 thread만 초기화를 수행하도록 표준으로 정해져서 wiki 예제에서는 단순히 static 변수를 써서 singleton을 구현하는 방법을 보여주고 있다.
* [Balking](http://en.wikipedia.org/wiki/Balking_pattern), [Guarded suspension](http://en.wikipedia.org/wiki/Guarded_suspension), Leaders/Followers, [Scheduler](http://en.wikipedia.org/wiki/Scheduler_pattern), [Threadpool](http://en.wikipedia.org/wiki/Thread_pool_pattern), [TLS](http://en.wikipedia.org/wiki/Thread-Specific_Storage) 등은 그냥 읽어보면 된다.

### [Readers–writer lock](http://en.wikipedia.org/wiki/Read_write_lock_pattern) ###

Read Write Lock Pattern은 multiple-readers(shared), single-writer(exclusive) lock을 구현하는 것. writer starvation은 limit-read-count를 쓰던, timeout을 쓰던 잘 처리하면 된다.

재귀(recursive-policy)를 고려하면 문제가 약간 복잡해진다. 같은 객체의 여러 method가 read/write lock을 걸 수 있고, 그 함수들간의 호출이 가능하다고 가정하자. 그러면 다음의 4가지 경우에 대해서 고민이 필요하다.

* read lock 걸고 read lock 또 걸면?
* read lock 걸고 write lock 걸면?
* write lock 걸고 write lock 또 걸면?
* write lock 걸고 read lock 걸면?

1. read/read는 read가 shared lock이니 그냥 둬도 문제가 없겠다.
2. write/write와 write/read를 허용하려면, write lock을 획득하는 당시 획득한 thread-id를 기록해두어 재귀를 허용하도록 구현해야 한다.
3. read/write를 허용하는 좋은 방법은 없다. 처음에 read lock을 획득하고 시작해서, 갑자기 write lock으로 상승(upgrade)해버리면 같이 진입한 read lock thread들의 처치가 곤란하기 때문이다.

때문에 upgradable-read mode를 추가한다. 그래서 read, upgradable-read, write 간의 상관관계를 재정의하여 재진입성을 다시 고려한다. 이에 대한 개념은 데이터베이스에서 잘 확인해볼 수 있다.

* [MSDN: ReaderWriterLockSlim](http://msdn.microsoft.com/en-us/library/system.threading.readerwriterlockslim.aspx)
* [MSDN: Lock Compatibility (Database Engine)](http://technet.microsoft.com/en-us/library/ms186396.aspx)


### asynchronous method ###

잘 기억은 안 나는데 asynchronous method에 대해서 잠깐 이야기가 있었다. async-method를 요청할 때의 코드 패턴에 대한 이야기였는데

```cpp
void request_async(request_context context, async_state state, callback_t callback) {
    async_result result = magical_async_method(context);
    callback(result, state);
}
```

비동기 함수 요청을 할 때, 요청자의 상태를 저장하기 위한 async_state를 callback과 함께 async_method에 넘기면, async_method에서는 인자로 받은 async_state를 async 수행 결과 결과(async_result)와 함께 callback으로 넘겨준다는 이야기이다.

iocp의 경우 overlapped 구조체를 상속받아서 async_state와 async_result 역할을 하나의 구조체에서 수행하기도 한다. proactor pattern 중 이를 async token이라고 표현하기도 한다.

### [MapReduce](http://en.wikipedia.org/wiki/MapReduce) ###

map/reduce는 functional programming에 있는 그 개념을 그대로 분산시스템에 적용했다고 보면 되겠다. 다만 fault tolerant를 고려해주면 되겠다.

### Remote Session ###

RemoteSession은 java.rmi와 같이 stateless한 rpc에서 proxy가 내부적으로 session key를 갖고 session을 유지해주기 위해 본인이 직접 구현한 library인데 본인이 wiki에 추가해놓은 것 같다. 넘어가자.

### [eincs: CAP Theorem, 오해와 진실 (PACELC)](http://eincs.net/2013/07/misleading-and-truth-of-cap-theorem) ###

분산 시스템은 네트워크 시스템을 전제로 하니 P를 고려하지 않을 수 없다. 그리고 장애 발생 상황과 정상 상황에서는 고려해야 할 요소가 다르니 두 상황을 대칭적으로 비교할 수 없다.

그래서 결론은 **PACELC**. 장애 상황에서는 availability와 consistency를 고민하고, 정상 상황에서는 latency와 consistency를 고민하겠다는 것. availability은 장애 상황에서의 서비스 가용 상태를 뜻하고, latency는 정상 상황에서 모든 cluster가 동일한 값으로 갱신되는 시간이라고 생각하면 될 것 같다.

### fault tolerant ###

분산 시스템을 설계할 때에는 장애 상황에 대한 복구(fault tolerant)를 고민해서 작성해야 하기 때문에 기존에 고민하지 않았던 예외 상황에 대한 고찰이 많이 필요하겠다. 그러니까 시간나면 읽어보자.

* [joinc: SocketTimeout](http://www.joinc.co.kr/modules/moniwiki/wiki.php/Site/Network_Programing/Documents/Sockettimeout)
* [책: 서버 인프라를 지탱하는 기술](http://www.kyobobook.co.kr/product/detailViewKor.laf?ejkGb=KOR&linkClass=33090105&barcode=9788996241003)

특히 각 cluster로 요청된 작업이 실패했을 경우 이 작업에 대해 다시 요청하여 결과를 얻어내도록 하는 과정은 잊지 말고 고려하도록 하자.

### actor model ###

지난 번에 구현한 actor model은 진정한 actor가 아니기 때문에 자원 접근 측면에서 문제가 발생할 수 있다. 진정한 actor model이라면 다른 actor의 정보에 접근할 때에도 정보 접근 요청 message 같은 것을 보내서 처리해야 할 텐데, 만약에 해당 정보에 lock을 걸고 접근할 수 있도록 코드를 작성하였다고 해보자.

즉, actor A, B가 있고, B가 A의 특정 데이터를 가져올 때 A의 lock을 걸고 데이터를 가져오게 된다는 것이다.

```cpp
class a_t : public actor_t {
public:
    some_struct_t get_some() const { auto _ = read_lock(); return _some_struct; }
};
class b_t : public actor_t {
public:
    void process(a_t* a) {
        auto some_a = a->get_some();
        // .. do anything
    }
};
```

actor model로 구현한 주제에 lock을 쓴다는 점부터가 마음에 안 들지만 일단 그 부분은 그냥 넘어가자. 기존에 구현한 actor model의 job scheduling 방식은 *"해당 actor를 먼저 점유한 thread가 있으면 그 thread가 해당 actor의 job_queue가 빌 때까지 모두 처리한다"*이다.

때문에 A에서 B로 함수를 호출할 때, A의 함수 수행이 끝나기 전에 B의 함수가 호출될 수 있다. 이는 A가 A에게 message를 보낼 때와 다른 수행 양상을 보인다.

```cpp
class a_t : public actor_t {
public:
    void proc1() {
        post(&a_t::proc1);
        _b->post(&b_t::pass1);
        // do something 1
    }
    void proc2() {
        // do something 2
    }
};
class b_t : public actor_t {
public:
    void pass1() {
        // do something 3
    }
};
```

만약 단일 thread가 a_t::proc1() 함수로 진입했을 경우의 수행 흐름은 어떻게 될까?  
**do something 3, 1, 2 순으로 수행될 것이다.**

때문에 위의 코드로 돌아가서 lock 문제를 다시 살펴보자.

```cpp
class a_t : public actor_t {
public:
    void update() {
        auto _ = write_lock();
        // update some_struct upper half
        _b->post(&b_t::process, this);
        // update some_struct bottom half
    }
};
```

1. `a_t::update()` 함수가 호출된다. 일단 `some_struct`의 상위 반만 변경이 된다.
2. `b_t::process()` 함수가 호출된다. 이 때 `a_t::_some_struct`를 접근한다. lock이 걸려있지만 lock의 재진입 허용으로 인해 상위 반만 변경된 `a_t::_some_struct`를 가져가게 된다.

즉, invalid한 값으로 작업을 수행하게 된다.

정리를 하면, 일관되지 않은 함수 수행 패턴으로 인해 문제가 발생할 수 있다는 것이다. (A에서 A로 요청하면 함수가 끝나야 다음 함수가 수행되는데, A에서 B로 요청하면 함수 수행 도중에 다음 함수가 불린다). 이러한 상황에서 발생할 수 있는 문제까지 잘 고려하여 프로그램을 설계해야 할 것이다.