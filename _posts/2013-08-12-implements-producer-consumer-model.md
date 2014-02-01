---
layout: post
title: producer/consumer model 구현
tags: concurrency c++ study -pub
---

먹깨비 과제를 풀어보자. 여러 가지 구현법이 있을 것인데, 나는 간단하게

* 바구니는 공유 자원이니 lock으로 보호하고,
* 제빵사와 먹깨비는 actor로 만들어서 매 tick마다 상황 판단 후 작업을 처리하도록 했다.

따라서 공유 자원을 보호하기 위한 `spin_lock`과 actor 기반 코드를 만들었고 그 기반으로 바구니, 제빵사, 먹깨비를 만들었다.

먼저 `spin_lock`을 만들어보자. 이전 글에서 몇 번 설명한적 있으니 대충 보자.

```cpp
class spin_lock_t {
public:
    spin_lock_t() { _flag.clear(); }
    void acquire() { while (_flag.test_and_set()); }
    void release() { _flag.clear(); }
private:
    std::atomic_flag _flag;
};

class spin_lock_raii_t {
public:
    explicit spin_lock_raii_t(spin_lock_t& lock)
        : _lock(&lock) {
        _lock->acquire();
    }
    spin_lock_raii_t(spin_lock_raii_t&& other)
        : _lock(other._lock) {
        other._lock = nullptr;
    }
    ~spin_lock_raii_t() {
        if (_lock != nullptr)
            _lock->release();
    }
private:
    spin_lock_raii_t(const spin_lock_raii_t&);
    spin_lock_raii_t& operator = (const spin_lock_raii_t&);
private:
    spin_lock_t* _lock;
};

template <size_t _lockCount>
class spin_lock_support_t {
public:
    spin_lock_raii_t lock(int lock_index = 0) {
        return spin_lock_raii_t(_lock[lock_index]);
    }
private:
    spin_lock_t _lock[_lockCount];
};
```

* `spin_lock` 자체는 `atomic_flag`를 사용하여 간단히 만들었다.
* `spin_lock_raii`는 `spin_lock`을 가지고 생성자/소멸자에서 `acquire`, `release`해주는 raii class이다.
* 그리고 `spin_lock_support`를 만들어서 lock이 필요한 class에서 이를 상속받아 사용할 수 있도록 코드를 작성하였다. 상황에 따라 lock을 여러 개 사용할 수도 있으므로 lock 개수를 template 인자로 받도록 하였다.

이를 사용하여 구현한 바구니(basket)은 다음과 같다.

```cpp
class basket_t : public spin_lock_support_t<1> {
public:
    basket_t() : _bread_count(0) {}
    int count() const { return _bread_count; }
    void add() { ++_bread_count; }
    void sub() { --_bread_count; }
private:
    int _bread_count;
};
```

lock을 여러 개 사용할 필요가 없으니 `spin_lock_support`의 template 인자를 1로 지정하여 사용하였다. 이제 다른 actor에서 바구니를 접근할 때에는 다음과 같이 사용할 수 있다.

```cpp
auto locker = basket.lock();
if (basket.count() >= 20) return;
basket.add();
```

이제 actor를 만들어보자. ppl의 `concurrent_queue`는 너무 느려서 actor model의 mpsc queue를 구현하는데 적합하지 않은 것 같다. 따라서 `InterlockedSList`를 사용하여 간단히 구현해 보았다.

```cpp
typedef std::function<void()> message_t;
class actor_t {
public:
    actor_t() {
        _job_count = 0;
        InitializeSListHead(&_queue_head);
    }
    void post(message_t message) {
        struct job_entry_t : public SLIST_ENTRY {
            message_t message;
        };
        void* entry_memory = _aligned_malloc(sizeof(message_t), 
            MEMORY_ALLOCATION_ALIGNMENT);
        job_entry_t* entry = new (entry_memory) job_entry_t;
        entry->message = message;

        bool victim = _job_count.fetch_add(1) == 0;
        InterlockedPushEntrySList(&_queue_head, entry);
        if (!victim) return;
        
        int process_count = 0;
        do {
            PSLIST_ENTRY local_head = InterlockedFlushSList(&_queue_head);
            std::vector<message_t> messages;
            messages.reserve(1024);

            PSLIST_ENTRY it = local_head;
            PSLIST_ENTRY next = nullptr;
            while (it != nullptr) {
                next = it->Next;

                job_entry_t* each_entry = reinterpret_cast<job_entry_t*>(it);
                messages.push_back(each_entry->message);

                each_entry->job_entry_t::~job_entry_t();
                _aligned_free(each_entry);
                it = next;
            }
           
            for (auto it = messages.rbegin(); it != messages.rend(); ++it)
                (*it)();
            process_count = static_cast<int>(messages.size());
        }
        while (_job_count.fetch_sub(process_count) != process_count);
    }
    template <typename _SubTy>
    void post(void (_SubTy::*method)()) {
        _SubTy* sub_instance = static_cast<_SubTy*>(this);
        post([sub_instance, method] () { (sub_instance->*method)(); });
    }
private:
    SLIST_HEADER _queue_head;
    std::atomic_int _job_count;
};
```

원리는 간단하다.

* 수행할 작업을 `void ()` 형태로 받아서 `InterlockedSList` 기반의 queue에 넣는다.
* 그리고 처음 queue에 넣는 thread를 victim으로 삼아서 queue 내에 들어있는 작업들을 계속 처리하도록 한다.
* 이 때 절묘한 타이밍으로 queue에 넣은 작업이 처리될 수 없는 문제를 해결하기 위해 `_job_count`로 처리 구간을 보장해준다.

template 인자를 받는 `post()` 함수는 이 actor를 상속받은 하위 class들의 member function pointer를 받아서 this에 대해 `post()` 함수를 호출해주는 helper function이다. 이 helper function이 있으면 다음과 같이 간결하게 `post()`를 호출할 수 있다.

```cpp
eater_t eater;
eater.post(&eater_t::act);
```

`post()`가 가능한 actor 기반을 만들었으니, 이를 기반으로 주기적인 작업을 수행하기 위한 interface를 정의해보자. 간단히 다음과 같이 `tick_actor_t`를 선언하였다.

```cpp
class tick_actor_t : public actor_t {
public:
    virtual void act() = 0;
};
```

`tick_actor_t` class는 주기적으로 `act()` 함수가 불려져서 뭔가 지속적인 작업을 처리할 수 있도록 하는 의미를 지닌 interface이다.

그러한 방식으로 구현이 되려면 다음의 개념이 필요하다.

* 누가(어떤 thread가) 해당 actor를 도맡아서 주기적으로 `act()` 함수를 불러주는가?

결국 thread를 관리하고, 각 thread에게 (대충) 공평하게 actor를 분배하고, 각 thread는 담당하는 actor를 처리하는 구조를 작성하여야 한다. 이에 대해서는 다음과 같은 개념으로 구현을 하였다.
* *시나리오*를 통해 어떤 actor가 등장할지 각 thread에게 전달된다.
* 각 *일꾼(worker-thread)*들은 시나리오를 보고 자기가 담당해야 할 역할(actor)을 기억한다.
* 각 *일꾼(worker-thread)*들은 자기가 연기할 대상(actor)을 주기적으로 연기(act)한다.

해서 `scenario`, `worker`, 그리고 worker를 관리하기 위한 `worker_pool` class가 등장하였다.

```cpp
class scenario_t {
public:
    typedef std::function<tick_actor_t* ()> tick_actor_factory_t;
    typedef concurrency::concurrent_queue<tick_actor_factory_t> tick_actor_factory_queue_t;

    scenario_t(int worker_count)
        : _worker_count(worker_count) {
        _worker_sched_index = 0;
        _tick_actor_factory_queue_array = new tick_actor_factory_queue_t[worker_count];
    }
    ~scenario_t() {
        delete[] _tick_actor_factory_queue_array;
    }
    int get_worker_count() const { return _worker_count; }
    void enter(tick_actor_factory_t factory) {
        int current_sched_index = _worker_sched_index++ % _worker_count;
        _tick_actor_factory_queue_array[current_sched_index].push(factory);
    }
    tick_actor_factory_queue_t& get_factory_queue(int index) {
        assert(index >= 0 && index < _worker_count);
        return _tick_actor_factory_queue_array[index];
    }
private:
    int _worker_count;
    std::atomic_int _worker_sched_index;
    tick_actor_factory_queue_t* _tick_actor_factory_queue_array;
};
```

`scenario` class는 일꾼(worker)의 총 수가 몇 명인지 가지고 있다가, 어떤 배역(actor)이 등장(enter)하게 될 경우 round-robin 방식으로 각 worker와 연결된 queue에 배역 생성기(actor)를 넣어준다.

```cpp
class worker_t {
public:
    worker_t(scenario_t& scenario, int index)
        : _scenario(scenario), _index(index) {}
    void work() {
        typedef std::vector<tick_actor_t*> tick_actors_t;
        tick_actors_t tick_actors;
        auto& factory_queue = _scenario.get_factory_queue(_index);
        while (true) {
            scenario_t::tick_actor_factory_t factory;
            while (factory_queue.try_pop(factory)) {
                auto* new_actor = factory();
                tick_actors.push_back(new_actor);
            }
            for (auto it = tick_actors.begin(); it != tick_actors.end(); ++it) {
                auto& actor = *(*it);
                actor.post(&tick_actor_t::act);
            }
        }
    }
private:
    int _index;
    scenario_t& _scenario;
};
```

`worker` class에서는 자신에게 할당된 (scenario에서 enter하면 추가되는) 배역 생성 queue를 확인하여 새로 부여받은 배역(actor)이 있나 확인하여 자신이 관리하는 vector에 넣는다.
그리고 자신이 관리하는 모든 배역(actor)에 대해 `act()` 함수를 호출함으로써 각자의 `act()` 함수가 호출될 수 있도록 한다.

```cpp
class worker_pool_t {
public:
    worker_pool_t(scenario_t& scenario)
        : _scenario(scenario) { employ(); }
    ~worker_pool_t() {
        finalize();
    }
private:
    void employ() {
        for (int index = 0; index < _scenario.get_worker_count(); ++index) {
            _workers.push_back(std::thread([this, index] () {
                worker_t worker(_scenario, index);
                worker.work();
            }));
        }
    }
    void finalize() {
        for (auto& each : _workers) {
            each.join();
        }
        _workers.clear();
    }
private:
    scenario_t& _scenario;
    std::vector<std::thread> _workers;
};
```

그리고 `worker_pool` class에서 각 worker에 thread를 부여하고 이것들을 관리할 수 있도록 간단히 코드를 작성하였다.

기반 코드 작성이 끝났으니 먹깨비와 제빵사를 구현해보자.
`tick_actor` class의 `act()` 함수만 채우면 되니 간단하다.

```cpp
class baker_t : public tick_actor_t {
public:
    baker_t(basket_t& basket)
        : _basket(basket) {}
    virtual void act() {
        auto locker = _basket.lock();
        if (_basket.count() >= 20) {
            return;
        }
        _basket.add();
    }
private:
    basket_t& _basket;
};

class eater_t : public tick_actor_t {
public:
    eater_t(basket_t& basket)
        : _basket(basket) {}
    virtual void act() {
        auto locker = _basket.lock();
        if (_basket.count() <= 0) {
            return;
        }
        _basket.sub();
    }
private:
    basket_t& _basket;
};
```

각자는 `act()` 함수에서 자신이 참조하는 바구니에 `lock()`을 걸고, 문제의 제약조건에 따라 `count()`를 확인한 뒤 `add()` or `sub()`을 수행한다.

여기까지 만들고 보면 결국 공유 자원은 lock으로 보호되고, actor간의 message 통신이 없으므로 `post()` 함수가 무의미해졌다는 사실을 깨달을 수 있게 된다!


이제 main 함수에서 시나리오를 구성해보자.

```cpp
int _tmain(int argc, _TCHAR* argv[])
{
    scenario_t scenario(std::thread::hardware_concurrency());
    worker_pool_t pool(scenario);

    basket_t basket;
    for (int index = 0; index < 10; ++index)
        scenario.enter([&basket] () { return new baker_t(basket); });
    for (int index = 0; index < 10; ++index)
        scenario.enter([&basket] () { return new eater_t(basket); });

    return 0;
}
```

`scenario`를 먼저 만든다. 일꾼(`worker`) 수는 하드웨어가 지원하는 thread 개수로 지정한다. 이제 만들어진 `scenario` 객체로 `worker_pool` 객체를 만들면 일꾼들이 고용(employ)되어 준비가 완료된다.

배역들을 등장시키기 위해 `scenario`의 `enter()` 함수를 불러준다. 생성하는 코드 자체를 template 등으로 감쌀수도 있겠지만 그러면 코드가 복잡해지니 간단히 lambda로 구현한 factory method를 전달하였다. 이제 제빵사와 먹깨비가 round-robin 방식으로 각 worker에게 배정되어 관리될 것이다.


간단한 내용을 무의미하게 길게 코딩하는 법을 소개해 보았다.
처음 과제 자체가 actor model에 익숙해지는 것을 위해 multi-thread 동기화 예제를 좀 무리하게 냈던 것인데, 스터디에 참여했단 다른 친구들이 나처럼 의미없는 actor model을 구현하지 않고 재미있는 model을 구현해 주어서 참 다행이었다-_-;