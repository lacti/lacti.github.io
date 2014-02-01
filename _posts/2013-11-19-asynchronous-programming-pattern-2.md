---
layout: post
title: 비동기 프로그래밍 패턴 2
tags: async design -pub
---

위 이야기에 이어, async 작업과 then 작업 간의 상태 공유에 대해서 알아보자.  
async에서 then으로 상태를 전달하는 가장 기본적인 방법은 반환값을 사용하는 방법이다. 다른 방법으로는 lambda function에 의한 variable capture가 있겠다.

```cpp
// method 1: using return value
std::async([] () { return 1; })
    .then([] (std::future<int> f) { return f.get() + 1; })
    .then([] (std::future<int> f) { return f.get() + 1; });

// method 2: using variable capture by lambda function
int result = 0;
std::async([&result] () { result = 1; })
    .then([] () { ++result; })
    .then([] () { ++result; });
```

반환 값으로 모든 context를 전달하는 것에는 한계가 있기 때문에 capture를 통한 방법이 더 편할 수 있다.

하지만 capture되는 변수라는 것도 결국 접근 가능한 scope 내에 있을 때 컴파일러가 해줄 수 있는 것이기 때문에 요청해야 할 비동기 작업들이 여러 함수에 걸쳐서 분포할 경우에는 위 방법으로 구현하기도 간단하지는 않다. 따라서 직접 context와 수행할 작업을 묶어 `async_worker` class를 구현하는 경우도 있다.

async_worker는 대충 context + async_work라고 생각하면 된다.

```cpp
class my_async_worker {
public:
    // async works
    void work1();
    void work2();
    void work3();
private:
    // contexts
    int _context1;
    std::string _context2;
};
```

즉 수행할 작업을 모두 멤버 함수로 넣고, 필요한 정보를 멤버 변수로 넣는다. 그리고 객체를 생성하고, 각 작업들을 비동기로 수행하고, 모두 완료되면 객체를 메모리에서 해제한다.

async_worker 개념은 단순하고 직관적이다. 마치 functor를 만들기 위해 struct를 하나 만들고 `operator ()`를 구현하는 것과 비슷하다. 그리고 struct functor를 lambda function으로 바꾸듯, 대부분의 경우 async_worker는 async/then 패턴으로 코드를 정리할 수 있을 것이다.

약간의? 차이가 있다면

* async는 그 자체가 오래 걸리는 작업인 경우가 많은데,
* async_worker의 `work()` 함수들은 다른 비동기 작업의 완료(completion)에 의해 callback으로 불리는 경우도 있고,
* 각기 다른 [객체의 수행 흐름]({% post_url 2011-08-11-synchronize-function-execution-in-each-object %})에서 불리는 경우도 있다.

async_worker 패턴은 stackless coroutine 구현으로도 사용될 수 있다. stackless coroutine은 stack을 갖지 않는 coroutine으로 c#의 async/await을 생각하면 된다. 즉 instruction pointer와 stack pointer를 치환하는 방식의 coroutine이 아닌 compiler의 code generation을 통해 multiple entry/return을 구현하는 방식이라고 생각하면 되겠다.  
(자세한 이야기는 coroutine 이야기에서 다루도록 하겠다)

쉬운 접근을 위해 `my_async_worker` 코드를 다음과 같이 고쳐보도록 하겠다.

```cpp
class my_async_worker {
public:
    bool execute() {
        if (_state == 0) { work1(); _state = 1; return true; }
        if (_state == 1) { work2(); _state = 2; return true; }
        if (_state == 2) work3();
        return false;
    }
private:
    int _state;
    // functions
    // contexts
```

비동기 함수의 context와 function을 private으로 갖고, execute() 함수만 노출되어 있다. 그리고 `execute()` 함수가 불릴 때마다 state가 전이되어 차례로 work1, 2, 3이 호출될 수 있도록 해준다.

* 즉 `my_async_worker::execute()`를 처음 불러서 `work1()` 작업을 수행한다.
* 그리고 `work1()` 작업에 대한 completion이 도착하면 다시 `execute()`를 불러서 `work2()` 작업을 수행한다.
* 그리고 `work2()` 작업에 대한 completion이 도착하면 다시 `execute()`를 불러서 `work3()` 작업을 수행한다.
* 이 때 `execute()`는 return을 반환하므로 더 이상 수행할 작업이 없는 것이다. 따라서 `my_async_worker` 객체를 메모리에서 제거한다.

위와 같은 state machine은 기계적으로 생성이 가능하기 때문에 compiler에서 위와 같은 방법을 사용하여 구현한 c#의 async/await이 있는가 하면 [c에서는 macro으로 구현한 것](http://www.chiark.greenend.org.uk/~sgtatham/coroutines.html)도 있다.

async를 통해 비동기 작업을 시작한 후 then으로 이어할 작업을 설정하는 async/then 패턴과, 수행할 비동기 작업과 context를 묶어서 하나의 객체로 구성하는 async_worker 패턴을 간단히 알아보았다.

각자의 기본 개념을 적절히 이해하여 각 상황에 맞게 적절히 사용하면 되겠다.