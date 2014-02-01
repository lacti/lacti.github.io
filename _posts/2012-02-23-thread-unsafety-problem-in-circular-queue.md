---
layout: post
title: 환형큐의 thread unsafety 문제
tags: concurrency c++ -pub
---

어떤 자원에 대한 환형큐가 있다고 해보자. size는 2의 자승이다.

```cpp
void push(resource_t res) {
    int index = atomic_inc32(&rear_) & (size_ - 1);
    array[index] = res;
}
resource_t pop() {
    int index = atomic_inc32(&front_) & (size_ - 1);
    return array[index];
}
```

위 코드는 당연히 thread safety 하지 않다. 하지만 문제가 발생하지 않도록 나름 머리를 써서 다음과 같이 위 코드를 사용한다고 해보자.

```cpp
void work(resource_t old) {
    push(old);  // release old resource
    resource_t newone = pop(); // acquire new on
    // do some work
}
```

예전 자원을 반환하고, 새로운 자원을 할당받아 그것으로 무슨 작업을 하는 것이다.  
이렇게 되면 pop 을 부르는 시점의 thread 는 적어도 자신이 push 한 자원 1개가 반드시 존재함을 보장할 수 있으니까 문제가 생기지 않는다.

라고 생각하면 함정.

thread 4개가 동시에 work 함수를 수행한다고 해보자.

* push를 수행했으니까 `rear_`는 4만큼 증가한다.
* 가장 마지막으로 `rear_`를 증가시킨 thread만 `array`에 `resource_t`를 대입하였고,
* 나머지 thread들은 아직 `array`에 대입하기 전이다.
* 그러면 `index`만 증가해있고, 실제 배열은 비어있다.
* 그래서 마지막 thread가 `pop`을 할 때 access violation으로 프로그램이 사망한다.

즉, `index`의 증가는 atomic함을 보장하지만 그것이 배열에 자원이 대입되었음을 보장해주지 못하므로 사망한다.

척 봐도 당연한 소리를 여기에 쓰고 있는 이유는, 이걸 직접 당해보고도 몇 달 지나니까 다시 이 사실을 까먹기 때문이다-_-;