---
layout: post
title: dumpable 고찰
tags: c++ template -pub
---

하재승님께서 [던전 앤 파이터 클라이언트 로딩 속도 최적화](http://lacti.me/2014/05/29/ndc14-dungeon-and-fighter-loader-optimization/)에서 언급하신 [dumpable](https://github.com/ipkn/dumpable) 라이브러리에 대한 이야기를 해보자. 이 라이브러리는 serializable memory가 가능한 dynamic container와 `operator =`를 사용하여 dumpable한 struct를 만들어준다.

다만 몇 가지 아쉬운 점이 있었다. 

- `dptr::alloc()` 함수가 thread safe하지 않다는 점
- dstring, dvector가 custom allocator를 지원하지 않는다는 점
- container의 type이 많지 않다는 점

때문에 [dumpable을 fork해서](https://github.com/lacti/dumpable) 문제를 고쳐보기로 했다.

- 일단 `dptr:alloc()` 내의 static 변수를 thread_local로 변경해서 local_pool이 겹치지는 않도록 했다. 하나의 thread가 dumping을 하는 도중에는 다른 copy가 불가능하기 때문에 대충은 thread safe해졌다.
- custom allocator를 넣어보려고 이리저리 뜯어보니 상당히 고쳐줘야 한다. 일단 type부터 다시 재정의를 해야 할 것 같다.

고민을 좀 해보다보니 뭔가 기존 stl container에 allocator만을 가지고 tmp를 잘 해보면 되지 않을까라는 생각이 들었다. 뭔가 복사할 때에만 serialize를 위한 allocator로 교체해서 그 쪽의 메모리를 할당해주면 되지 않을까!

1. data type을 정의한다. 이 data type은 serializable할 것인지 말 것인지 template param으로 bool 값을 갖는다.
2. data type에서 사용하는 stl container는 위 bool 값에 의해 `std::allocator`를 쓸지 `serializble_allocator`를 쓸지 `std::conditional`로 결정한다.
3. data type은 자신의 bool 값을 rebind하여 serializable 가능한 type을 갖는다.
4. `write` 함수에서는 rebind된 type의 객체를 만든 후, 원본 객체로부터 복사를 유도하여 dumpable처럼 `operator =`에 의한 복사를 유도해보도록 하자.

결론부터 이야기하자면 성공할 수 없는 삽질이다. 좀 더 자세한 설명을 위해 코드를 보자.

```cpp
namespace ser {
    template <typename T, bool do_serialize = false>
    struct vector {
        typedef std::conditional<do_serialize, allocator<T>, std::allocator<T>> allocator_type;
        typedef std::vector<T, allocator_type> type;
    };

    template <template <bool> class Base>
    struct make_serializable {
        typedef Base<true> serializable_type;
    };
}
```

- 간단히 vector만 다시 정의해봤다. `do_serialize` 값에 따라 allocator만 바꿔주는 녀석이다.
- `make_serializable` 역시 별거 없고 그냥 Base type에 대해 serializable 값만 바꿔준다.(rebind)

그리고 다음과 같이 data를 쓰려고 했다.

```cpp
#define SERIALIZABLE(name) \
    template <bool do_serialize = false> \
    struct name : ser::make_serializable<name>

SERIALIZABLE(data) {
    ser::vector<int, do_serialize> values;
};
```

위와 같이 정의하고,

```cpp
template <typename T>
void test(const T& t) {
    typedef typename T::serializable_type serializable_type;
    serializable_type ser_obj;
    ser_obj = t;
}
```

이런 식으로 테스트를 진행하려고 했다. 당연하지만 `data<true>`와 `data<false>`는 다른 type이기 때문에 `operator =`를 바로 호출할 수가 없다. `operator =` trick을 못 쓴다면 각 멤버에 대한 serialize 코드를 작성해주어야 한다는 것이므로 당초 목적을 달성할 수가 없다.

뿐만 아니라 allocator를 사용하는 방법 자체는 잘못되었다.

- container 내에는 pointer type이 많이 있는데 이는 allocator를 통해 할당 공간만 어떻게 하나로 합친다고 해서 될 수 있는 내용이 아니다.
- 프로그램 구동 시 처음 한 번 loading된 이후 변경이 없는 데이터의 경우 loading memory address를 강제로 고정해서 위 문제를 해결할 수 있을지는 모르겠지만, 그렇게 되면 범용적으로 사용할 수가 없다.

따라서 dumpable처럼 container도 따로 구현해야만 한다. 많은 container가 없다는 점이 조금 아쉽기는 하지만 일단 custom allocator를 사용할 수 있는 수준까지 고쳐보고 다시 고민을 더 해봐야겠다.
