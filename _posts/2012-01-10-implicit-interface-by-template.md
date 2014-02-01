---
layout: post
title: template의 암시적 interface 요구
tags: c++ template -pub
---

상속을 통한 동적 다형성을 이용하려면, 명시적인 interface가 형성되어야 한다.

```cpp
class game_object {
public:
    virtual void update(float dt) = 0;
};

class character : public game_object {
public:
    virtual void update(float dt) { }
};
class item : public game_object {
public:
    virtual void update(float dt) { }
};
```

와 같이 interface와 이를 구현(implements)하는 구체 class를 작성하고

```cpp
std::vector<game_object*> objects;
std::for_each(objects.begin(), objects.end(), [=] (game_object* obj) {
    obj->update(dt);
});
```

이처럼 동일한 interface로 취급할 수 있도록 하나의 container에 각 구체 class들의 객체를 담고
iterating하면서 `update` 함수를 불러준다. 이 때 type은 `game_object *`이므로 `update`라는 함수가 있다는 것을 명시적으로 보장해 줄 수 있다.


template을 쓰면 좀 더 유연해지는데, 굳이 `game_object`라는 interface를 명시적으로 두지 않아도 `update`라는 함수만 있으면 된다.

```cpp
class character {
public:
    void update(float dt) { }
};
class item {
public:
    void update(float dt) { }
};
```

`character`와 `item` 자체는 어쨌든 `update`라는 함수를 갖는다. 하지만 그 둘이 같은 interface를 갖는다는 명시적인 보장은 없다. (적어도 코드를 작성하는 사람이 눈으로 보고는 알 수 있겠다)

이에 하지만 만약 둘을 처리하는 로직이 공통될 경우 (둘 다 `update`을 불러줘야할 경우)가 있을 것이다.

```cpp
std::vector<character> characters;
std::vector<item> items;
std::for_each(characters.begin(), characters.end(), [=] (character& ch) {
    ch.update(dt);
});
std::for_each(items.begin(), items.end(), [=] (item& it) {
    it.update(dt);
});
```

그럼 위처럼 코드가 중복된다. 하지만 하는 동작이 동일하다면, (코드 형태가 유사하다면) 명시적인 interface 규약이 없어도 암시적으로 코드의 틀이 비슷하다는 것이니까 이 때 template을 쓴다.

```cpp
template <class _contTy>
void update_all(_contTy& cont, float dt) {
    std::for_each(cont.begin(), cont.end(), [=] (typename _contTy::value_type& val) {
        val.update(dt);
    });
}
```

위 template 함수는 어떤 container를 인자로 받아서, 그 내부를 순회하며 각 element들의 `update` method를 불러준다.

이 때 위 함수는

* container가 `begin`, `end` method를 갖고 있고,
* 그 반환 값이 forward iterator 이고,
* container의 type이 `value_type`이라는 typename을 갖고,
* 그 `value_type`은 `update`라는 method를 갖는다는

암시적인 규약을 내포한다.

이걸 왜 암시적이라고 부르냐하면, `update_all` 함수는 실제 사용되기 전까지 컴파일 대상이 아니며 사용되었을 때 해당 type으로 코드가 instantiate되면서 올바른 코드인지 검사하기 때문이다.

즉 `std::vector<character>`라는 type으로 위 함수를 부르게 되면,

```cpp
void update_all(std::vector<character>& cont, float dt) {
    std::for_each(cont.begin(), cont.end(), [=] (std::vector<character>::value_type& val) {
        val.update(dt);
    });
}
```

와 같은 적법한 코드가 생성되어, 이 때 `std::vector`가 `begin`, `end`, `value_type`을 가지고 있고, `value_type`인 `character`가 `update` 함수를 가지고 있으니 문제 없이 컴파일 되는 것이다.

즉 사용되는 시점에 코드를 찍어내는 것이고 실행 중(runtime) 에 모종의 작업이 필요한 것이 아니므로 interface나 abstract class같은 vfptr을 생성하는 명시적인 interface가 필요없다는 것이다. (이렇게 생각해보면 명시적/암시적 interface 라고 이름 붙이는 것도 웃긴 일이다)

template 함수의 또 하나의 장점은, 무시무시한 type inference와 코드 찍어내기로 인해 template 함수 내에서 요구하는 명세를 지키는 대상에 대해서는 모두 사용할 수 있게 해준다는 것이다.

예를 들어,
위 `update_all` 함수는 `vector`, `list`, `deque`, `set` 등 여러 stl container에 대해 사용 가능하기 때문에 굉장히 일반적인 함수라 할 수 있다. (generic 하다)


생각해보니 단순히 프로그래밍 측면에서 위의 두 내용을 비교하는 것은 바람직하지 못한 것 같다. 다음 글에서는 vfptr과 template instantiate의 세부적 내용을 통해 둘이 어떻게 다르고 어떤 장단점이 있는지 자세히 보도록 하자.