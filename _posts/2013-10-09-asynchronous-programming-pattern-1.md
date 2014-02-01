---
layout: post
title: 비동기 프로그래밍 패턴 1
tags: async design -pub
---

일련의 순서로 호출되어야 하는 비동기 함수들이 있다. 이 때 사용되는 method chaining을 사용한 async/then 패턴과 수행할 비동기 context를 갖고 직접 비동기 수행을 연쇄적으로 진행하는 async_worker 패턴을 알아보자.

연속적인 비동기 작업을 처리할 때에는 동기적 프로그래밍과는 다르게 코드를 순차적으로 서술할 수 없다. 만약 아래와 같이 작성된다면, `async_work2`나 `async_work3`는 그 위의 `async_work1` 혹은 `async_work2`가 완료되기 전에 시작될 것이다.

```cpp
async_work1();
async_work2();
async_work3();
```

간단하게 생각해볼 수 있는 방법은 하나의 작업이 끝난 후에 다음 작업을 호출하도록 하는 것이다.

```cpp
void entry_point() {
    async_work1();
}
void async_work1() {
    // do something
    async_work2();
}
```

그런데 만약 `async_work1`이 끝난 후 `async_work2`가 아니라 다른 *일반적인 작업*을 수행하게 하고 싶을 경우에는 위와 같이 구현할 수 없다. 그래서 선택하는 방법이 callback이다.

```cpp
void entry_point() {
    async_work1(async_work2);
}
void async_work1(std::function<void()> callback) {
    // do something
    callback();
}
```

위와 같이 코드를 작성하는 것은 꽤 타당해 보인다. 하지만 처음 문제로 돌아가서 1, 2, 3을 순서대로 실행하려면 코드가 좀 복잡해진다.

```cpp
async_work1([] () {
    async_work2([] () {
        async_work3(callback_none);
    });
});
```

즉 연쇄적인 작업을 수행하기 위해 callback에 callback을 넣는 형태로 코드를 작성하게 된다는 것이다.

- nodejs 계열에서 코드를 작성할 때에 위와 같이 작성하는 경향이 있다. nodejs는 비동기 io 기반이므로 간단한 서버 프로그래밍을 해도 중첩 callback에 의해 금새 tab depth가 깊어지는 것을 볼 수 있다.
- [angdev]님의 글을 보면 이를 해결하기 위한 라이브러리가 존재함을 볼 수 있다. 그 라이브러리는 아래 소개할 async/then 패턴을 nodejs에 적용한 것이라 볼 수 있겠다.


async/then 패턴은 task continuation을 생각하면 좋다. 비동기 작업을 추상화한 객체가 있고, 그 객체의 method chaining으로 이후 할 작업을 연결하는 형태이다.

* [MSDN: Continuation Tasks](http://msdn.microsoft.com/en-us/library/vstudio/ee372288.aspx)
* [A Standardized Representation of Asynchronous Operations](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2013/n3558.pdf)

즉 asynchronous하게 호출된 작업 뒤에 할 일을 이어서 붙이는 것이다.

* **c#**의 경우 비동기 요청을 할 경우 `Task` 객체를 반환하는데, `Task`의 method인 `ContinueWith()`으로 다음 할 일을 잇는 형태이다.
* **c++**의 경우 (표준이 의도한 바에 따르면) `std::async()`을 통해 비동기 요청을 수행하는데 이 때의 반환값은 `std::future`이다. 따라서 `future`에 `then()` method를 통해 다음 할 비동기 작업을 잇는다는 것이다.

[doodoori2]님께서 질문해준 것과 같이 `async()`로 시작된 작업에 대해 `then()`으로 이어서 할 작업을 추가해줄 때 동시성 문제가 발생할 수 있기 때문에 이를 적절히 잘 제어해주는 것도 중요하다.
`async()`로 시작된 작업에 `then()`을 추가할 때, 다음의 상태 중 하나일 수 있다.

1. 다른 thread에 의해 작업이 시작된 상태
2. 작업이 완료된 상태
3. 작업이 취소된 상태

* 2번(완료)일 경우 이미 완료되었으니 동시성 문제가 발생하지 않는다. `then()`을 연결하는 순간 그 callback을 실행해도 되고, 아니면 그 작업을 threadpool에 던져서 아무 thread나 수행(async)하게 만들어도 된다.
* 3번(취소)일 경우 `then()`을 연결하는 순간 예외를 발생시키는 등 추가할 수 없다고 적절히 알려주면 되겠다.
* 1번(진행)일 경우 동시성 문제가 발생할 수 있다. 간단히 then() 코드를 생각해보자.

```cpp
then(function_t next) {
    _next = next;
}
execute() {
    // execute something
    if (_next != nullptr) _next(_result);
}
```

문제가 발생할 수 있는 부분은 _next를 대입하는 곳과 _next를 호출하는 부분이다. 이 부분만 lock으로 잘 감싸서 동시성 문제를 해결하면 되겠다. 아래 링크의 자료를 보면 vs2012 기준 future는 내부에 StateManger라는 객체가 lock으로 보호하는 구조로 작성되어 있다. 같은 방법으로 `then()`으로 연결할 함수도 보호해줄 수 있을 것이다.  
[async, future, promise in c++](http://www.slideshare.net/lactrious/synchronizing-concurrent-threads)

async/then 패턴은 stateless한 일련의 비동기 작업을 서술할 때 편하다.

```cpp
req_async(case1).then(case1_1).then(case1_2);
req_async(case2).then(case2_1);
req_async(case3).then(case3_1).then(case3_2).then(case3_3);
```

`req_async()`에 의해 비동기로 수행되는 작업(task)들은 내부의 task-scheduler에 의해 적절한 thread를 할당받아 작업이 동시에 처리될 것이다(task-parallelism)

만약 각 case에서 수행되는 작업들이 io-boundary 등의 system 작업들이라면 위 코드는 단일 thread에서도 동작할 수 있다. thread 하나가 모든 `req_async` 작업을 요청한 후 각각의 completion을 대기한 후 `case*_1` 함수를 이어서 불러주면 되기 때문이다(nginx 등)


위 이야기에 이어, async 작업과 then 작업 간의 상태 공유에 대해서 알아보자.  
`async`에서 `then`으로 상태를 전달하는 가장 기본적인 방법은 *반환값*을 사용하는 방법이다. 다른 방법으로는 lambda function에 의한 variable capture가 있겠다.