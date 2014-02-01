---
layout: post
title: asynchronous programming과 async, await
tags: async -pub
---

함수를 호출하는 코드를 작성한다고 해보자. synchronous하게 호출하는 방법이 있고, asynchronous하게 호출하는 방법이 있다. (보통 후자는 호출이라고 하기보다는 요청을 한다고 할 것이다)

코드를 작성하는 프로그래머 입장에서는 당연히 synchronous한 로직이 훨씬 직관적이고 이해하기 편한다. 위에서부터 아래로 코드를 읽어내리기만 해도 이게 무슨 동작을 하는 코드인지 이해하기가 쉽기 때문이다.

하지만 여러 성능적 이슈로 인해 많은 함수들이 asynchronous하게 작성된다. 이럴 synchronous한 호출 구조를 갖는 코드에 비해 로직을 이해하기 힘들어진다. (callback 의 callback 의 callback 의 ... 를 부르는 함수 구조를 읽어나가면, 어떤 상황에서 어떤 코드가 실행되는지 조차 파악하기 힘들다)

이 글에서는 간단하게 RPC(remote procedure call) 예제를 통해 위 내용을 살펴보겠다.

```cpp
call_result request_call(call_context ctx) {
    sock_write(socket_, ctx.serialize());

    BYTE result_buffer[RESULT_SIZE];
    sock_read(socket_, &result_buffer);
    return call_result.parse(result_buffer);
}
```

위 `request_call`이라는 함수는 함수 호출 정보(`call_context`)를 인자로 받아서, 원격지(remote)와 연결된 소켓(`socket_`)으로 해당 내용을 전송한다(`sock_write`). 그리고 그에 대한 응답이 올 때까지 동기적(synchronous)으로 기다려서 데이터를 읽고(`sock_read`) 그 결과(`call_result`)를 반환한다.

이렇듯 synchronous하게 수행되는 코드는 (절차지향적이므로) 위부터 아래로 읽어나가면 이 코드가 무슨 행동을 하는지 파악하기 쉽다. 하지만 위처럼 `sock_read`라는 대기(blocking) 함수를 사용하여 동기적 수행을 만들 경우 위 함수의 처리 효율은 굉장히 나빠진다. **왜냐하면 결과가 올 때까지 해당 스레드는 아무 작업을 못하고 기다리기 때문이다.**


이 문제를 개선하려면 요청 후 결과가 올 때까지 기다리지 않으면 된다.  
즉, RPC 함수 요청이 발생하면 그 요청 객체(`call_context`)를 만들어서 원격지에 보내되 그로부터 결과가 오는 것은 기다리지 않고, 다만 그것에 대한 결과를 미래에(future) 받을 것이라고 약속(promise)만 한다.

그리고 원격지로부터 데이터를 읽는 thread들은 데이터가 도착하면 그 요청 결과(`call_result`)가 어떤 요청(`call_context`)에 대한 것인지 확인하여 그 요청을 기다리는 thread에게 알려준다(asynchronous notification)

```cpp
void request_call(call_context ctx) {
    int request_id = register_request(thread_id());
    send_request(request_id, ctx);
}

void receive_result(call_result result) {
    int thread_id = remove_request(result.request_id);
    thread_post(thread_id, rpc_callback, result);
}
```

`request_call` 함수는 요청 객체를 보내기 전에 일단 자기 `thread_id`에 대해 `request_id`를 발급 받는다. 그리고 그걸 원격지로 보내기만 하고 바로 반환된다. 그에 대한 응답이 도착하면 read thread가 그 결과(`call_result`)를 읽어서 해당 결과가 어떤 thread가 요청한 것인지 찾는다. 그리고 그 thread 에게 `rpc_callback` 함수를 수행하라고 통지(notification) 해준다.

동기적인 수행 구조를 갖는 코드보다 확실히 코드가 복잡해졌다. 그리고 `rpc_callback` 이라는 함수가 어느 시점에 호출될지 모른다는 점에서 공유 자원 관리에 대한 문제가 추가로 발생하기도 한다.


위 내용을 요약해보면,

* 동기적 코드를 작성하는 것이 비동기적 흐름의 코드를 작성하는 것보다 더 쉽고, 이해하기도 쉽다. 즉 버그가 덜 생기고 문제가 생겨도 고치기 쉽다.
* 하지만 동기적 수행을 위해서 흐름이 blocking 되는 것은 그 동안 다른 일처리를 못한다는 관점에서 굉장히 비효율적이다.

효율성을 위해 비동기적 코드를 작성한다면, 여러 고민할 것들이 늘어나고, 코드 복잡도가 증가하고, ... 여러모로 힘들어진다.


이에 대해 가장 좋은 방법은 동기적으로 코드를 작성하되 비동기적으로 수행되는 것이다.

예를 들면 컵라면을 끓이고 햇반을 데워서 먹는다고 하자. 컵라면을 다 끓일 때까지 기다리고, 컵라면이 다 끓은 다음 햇반을 전자레인지에 데우는 것보다는, 컵라면에 물을 붓고 햇반을 전자레인지에 돌리는 것이 시간상 더욱 효율적일 것이다.

즉, 수행 흐름에 대기(blocking)하여 기다려야 할 요소가 있다면 해당 작업에 대한 완료 통지(completion notification)가 올 때까지 수행을 멈추고, 그 시간에 다른 작업이 있다면 그걸 꺼내서 하는거다.

다시 위의 코드로 예시를 들면,

```cpp
async call_result request_call(call_context ctx) {
    sock_write(socket_, ctx.serialize());

    BYTE result_buffer[RESULT_SIZE];
    await sock_read(socket_, &result_buffer);
    return call_result.parse(result_buffer);
}
```

`request_call` 함수는 async 함수다. async 함수는 중간에 await을 수행할 수 있는 함수이다. 위 코드에서는 `sock_read`라는 blocking 작업이 완료될 때까지 await을 한다는 것 외에는 동기적 코드와 다를 것이 없다. 하지만 수행 흐름을 보면 위 코드는 비동기적으로 수행된다.

`sock_read` 함수를 await하게 호출하였으므로 해당 thread는 `sock_read` 함수에 대해 완료 통지가 올 때까지 해당 수행 흐름을 중단한다. 그리고 다른 수행할 작업이 있는지 찾아보고 수행한다(context switch). 그 작업을 수행하는 도중에 아까 요청한 `sock_read` 에 대한 완료 통지가 온다면 적절한 타이밍에(scheduling) 아까 멈췄던 실행 흐름부터 이어서 수행을 한다.

즉, 동기적 흐름의 코드 형태를 띄지만 실제로는 비동기적으로 돌아간다는 것이며, 코드 작성의 용이성과 수행의 효율성을 모두 확보한다는 야심찬 방법이다. 실제로 위 문법은 C# 5.0 에서 지원하는 asynchronous programming에 포함되어있다.


다음 글에서는 async와 await가 동작할 수 있는 원리에 대해 간단히 살펴보고, 간단한 job queue와 thread-pool 모델을 사용하여 해당 방식을 흉내내어 보도록 하자.


### 참고 ###

* [C# 5 Async, Part 1: Simplifying Asynchrony – That for which we await](http://reedcopsey.com/2010/10/28/c-5-async-part-1-simplifying-asynchrony-that-for-which-we-await)