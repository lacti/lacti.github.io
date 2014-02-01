---
layout: post
title: thread-safe한 counter 구현
tags: concurrency c++ study -pub
---

먼저 간단한 counter example을 만들어보자.
문제를 확인하기 위해서 다음과 같은 코드를 작성해본다.

```cpp
const int thread_count = 128;
const int loop_count = 65536;

volatile int counter;

void add_entry()
{
    for (int loop_index = 0; loop_index < loop_count; ++loop_index)
        ++counter;
}

int _tmain(int argc, _TCHAR* argv[])
{
    std::vector<std::thread> threads;
    for (int thread_index = 0; thread_index < thread_count; ++thread_index)
    {
        threads.push_back(std::thread(add_entry));
    }

    for (auto& each : threads)
        each.join();

    std::cout << "expect: " << thread_count * loop_count << std::endl;
    std::cout << "actual: " << counter << std::endl;
    return 0;
}
```

c++ code 한 줄이 원자적(atomic)으로 실행된다는 보장은 없다. assembly의 한 줄도 원자적으로 실행된다는 보장은 없다(smp, micro-operation)  
위 코드를 release로 빌드해보면 `++counter` 부분에 대한 코드가 assembly로 한 줄이 나오는데, 어쨌든 expect와 actual 값이 다르게 나온다는 것은 해당 연산이 원자적으로 수행되지 않는다는 것이다.

재밌는 것은 volatile keyword를 제거한 후 release로 build하면 제법 문제없는 결과가 나오는 것처럼 보인다는 것이다. 그 이유를 생성된 assembly code를 통해 확인하면 알 수 있는데, `for (loop_counter) ++counter` 부분이 `counter += loop_counter` 코드로 최적화되어 버리기 때문이다. `counter += loop_counter` 명령은 원자적이지 않지만, 다음 thread가 생성되어 간섭하기 전에 완료될 수 있을만큼 명령이 단순하므로 thread간 간섭이 없어 문제가 발생하지 않는 것처럼 보이는 것이다. (직접 위 코드를 release로 빌드하여 assembly를 확인해보면 더욱 명확하다)

위 문제를 해결하기 위한 적어도 3가지 방법을 하나씩 알아보자.

### lock 사용 ###

가장 손쉬운 해결법은 lock을 사용하는 것이다.

```cpp
std::mutex m;

void add_entry()
{
    for (int loop_index = 0; loop_index < loop_count; ++loop_index)
    {
        std::unique_lock<std::mutex> lock(m);
        ++counter;
    }
}
```

간단하게 전역 변수로 mutex를 추가하고, `++counter` 수행 전후의 단일 thread 진입을 보장해주기 위해 lock을 걸었다. 수행시간이 굉장히(!) 오래 걸리고 cpu도 엄청 소모하지만 한참 기다리면 어쨌든 actual과 expect가 동일하게 나오는 것을 볼 수 있다.

### atomic_int ###

두 번째 해결책은 `atomic_int`를 사용하는 것이다. [volatile과 interlocked operation]({% post_url 2011-08-02-volatile-interlocked-operation %})

```cpp
std::atomic_int counter;

void add_entry()
{
    for (int loop_index = 0; loop_index < loop_count; ++loop_index)
        ++counter;
}
```

결과도 굉장히 빠르게 나오고, 제대로 actual과 expect가 같게 나온다. `atomic_int::operator++ ()`은 내부에서 `atomic_fetch_add()` 함수를 부르게 된다. 여기서 memory_order를 지정할 수 있는데  windows api는 (arm을 사용하지 않을 경우) memory order가 뭐인지와 상관없이 `_InterlockedExchangeAdd()` Intrinsic 함수를 부른다. (물론 기본 memory_order 값은 `memory_order_seq_cst`이다)


세 번째 해결책으로 넘어가기 전에 두 번째 해결책에서 배운 atomic을 사용하여 첫 번째 해결책의 성능을 개선해보자. lock을 직접 만들어서 성능을 개선하는 것이다. [Cppref: atomic_flag](http://en.cppreference.com/w/cpp/atomic/atomic_flag)

```cpp
volatile int counter;
std::atomic_flag lock = ATOMIC_FLAG_INIT;

void add_entry()
{
    for (int loop_index = 0; loop_index < loop_count; ++loop_index)
    {
        while (lock.test_and_set(std::memory_order_acquire))
             ; // spin
        ++counter;
        lock.clear(std::memory_order_release);
    }
}
```

동기화를 위해 `atomic_flag`를 사용한다. lock이라는 flag를 획득하지 못할 경우 spin-wait을 수행하고, 얻으면 `++counter`를 한다. 작업이 끝나면 lock flag를 clear해서 다른 thread가 진입하게 하는 것이다. 이전에 lock을 쓸 때에 비해서 성능이 훨씬 좋아졌다. (그래도 `atomic_int`를 사용하는 것에 비하면 많이 느리다.)

### message passing with actor ###

세 번째 방법은 actor 기반의 message passing을 사용하는 것이다.

```cpp
enum message_t {
    msg_none,
    msg_add
};

class actor_t {
public:
    actor_t() 
        : exited(false) {
        worker = std::thread(std::bind(&actor_t::dispatch, this));
    }
    ~actor_t() {
        exited = true;
        worker.join();
    }
    void dispatch() {
        message_t msg = msg_none;
        while (message_queue.try_pop(msg) || !exited) {
            switch (msg) {
            case msg_none:
                std::this_thread::sleep_for(std::chrono::seconds(0));
                break;
            case msg_add:
                ++value;
                break;
            }
            msg = msg_none;
        }
    }
    void request(message_t msg) {
        message_queue.push(msg);
    }
public:
    int value;
private:
    bool exited;
    std::thread worker;
    concurrency::concurrent_queue<message_t> message_queue;
};

actor_t counter;

void add_entry()
{
    for (int loop_index = 0; loop_index < loop_count; ++loop_index)
        counter.request(msg_add);
}
```

`actor_t`는 `dispatch()` 함수에서 `message_queue`에 쌓인 message를 자체적인 worker thread를 사용하여 비동기로 처리되도록 구성된 class이다(대충 구현해서 성능은 안 좋다). `concurrent_queue`가 비어있을 때(`empty`)에는 `try_pop()`이 바로 실패하므로, worker thread가 message를 과도하게 busy-waiting하지 않도록 대충 `sleep(0)`을 넣어주었다.

어쨌든 각 test thread들은 `add_entry()`에서 `counter`라는 actor에게 `msg_add`를 전달하고, `msg_add`는 `counter`의 `message_queue`에 쌓이게 된다. 그러면 `counter`내의 worker thread가 `message_queue`에 쌓인 `msg_add`를 하나씩 처리하기 때문에 `counter::value` 변수는 하나의 thread만 (write를 위해) 접근하게 되고, 이 변수는 간섭없이 증가할 수 있는 것이다.

다만 위 코드를 수행할 경우 프로그램의 수행 시간이 굉장히 오래 걸린다. (`std::mutex`/`lock`을 사용했을 때 보다도 몇 배는 더 오래 걸린다.) 그 이유는 actor를 대충 구현해서 그런 것도 있지만 `concurrent_queue`가 너무 느린 것도 한 몫 하는 것 같다-_-

### 정리 ###

다양한 방법으로 counter example의 공유 자원 정합성 문제를 해결해보았다. 게임 등의 다른 로직에서도 위에서 언급한 방법 혹은 다른 방법을 통해 동시성 보장을 위해 상황에 맞는 적절한 방법을 찾아 구현하면 되겠다. (물론 난 별로 자신 없다-_-)