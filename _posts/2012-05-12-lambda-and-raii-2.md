---
layout: post
title: lambda와 RAII 2
tags: c++ -pub
---

C++11은 lambda expression을 지원해주니 좀 다르게 생각해볼 수 있다.

```cpp
class lock_t {
public:
    template <typename functor>
    void scoped(functor& func) {
        lock();
        func();
        unlock();
    }
};
```

`lock_t` class 자체에 위와 같이 functor를 받아 실행할 수 있는 함수를 만든다. 그리고 그 앞 뒤로 lock-unlock을 불러준다.

이렇게 하면 lambda를 사용하여 lock 사용 코드를 보다 깔끔하게 정리해볼 수 있다.

```cpp
item_ref inventory_t::find(item_id_t item_id) {
    item_ref item(NULL);
    lock.scoped([&item] () {
        auto iter = std::find(items.begin(), items.end(), find_item_by_id(item_id));
        if (iter != items.end())
            item = (*iter);
    });
    return item;
}
```

lambda를 통해 lock 구문을 수행하는 코드를 보다 깔끔하게 묶어낼 수 있다... 라고 이야기하고 싶지만, item이라는 값을 반환해야할 방법이 딱히 없어서 외부에서 변수를 선언하고 내부로 전달하는 영 좋지 못한 방법을 쓰고 있다.

약간 이야기가 다른 길로 가지만, 보다 깔끔한 해결책을 위해 아래와 같이 코드를 작성해볼 수 있다는 것을 이야기하고 싶다.

```cpp
class lock_t {
public:
    template <typename R, typename functor>
    R&& scoped_return(functor&& func) {
        lock();
        R&& r = func();
        unlock();
        return std::move(r);
    }
};
```

lock 범위 내에서 값을 반환할 수 있는 형태의 코드를 작성한 뒤 이를 사용하도록 한다는 것이다.

```cpp
item_ref inventory_t::find(item_id_t item_id) {
    return lock.scoped_return<item_ref>([=] () {
        auto iter = std::find(items.begin(), items.end(), find_item_by_id(item_id));
        return (iter != items.end())? (*iter): NULL;
    });
}
```

물론 값을 쓸데없이 복사하는 구간이 있는데, 저 부분은 다시 RAII를 사용하여 묶는 등 코드를 좀 더 정리해볼 수 있겠다. (그게 귀찮아서 위처럼 r-value를 썼는데, 어차피 move constructor가 구현되어있지 않다면 저 방법은 효윺이 영 좋지 않을 수 있다.)


lambda를 이용해 raii 영역을 하나의 scope로 묶어주는 방법에 대해서 정리해봤다. 하지만 이 방법을 써도 결국 최종 지점 (위 예제에서는 scoped 함수)에서는 결국 raii를 사용하여 자원을 관리할 필요가 있게 된다.

이러한 패턴은 생각보다 자주 등장하게 되므로, 이에 대한 일반적인 패턴을 만들어놓으면 좋을 것이다. 이를 만족시키는 적절한 template class 를 작성해보자.

```cpp
template <class _Ty, void (_Ty::*begin)(), void (_Ty::*end)()>
class raii_t {
public:
    raii_t(_Ty* _obj)
        : obj(_obj) {
        (obj->*begin)();
    }
    ~raii_t() {
        (obj->*end)();
    }
private:
    _Ty* obj;
};
```

`raii_t`라는 class는 특정 type과, 그 type에 대해 시작 시 수행할 함수와 끝날 때 수행될 함수를 template 인자로 받는다. 이제 `lock_t`에 대한 `lock_raii_t` class는 다음과 같은 typedef로 정의할 수 있다.

```cpp
typedef raii_t<lock_t, &lock_t::lock, &lock_t::unlock> lock_raii_t;
```

`lock_raii_t`는 `lock_t`에 대해 동작하면서, 해당 변수가 생성 시 `lock_t::lock()` 함수를 부르고, 소멸될 때 `lock_t::unlock()` 함수를 부르게 된다.

```cpp
lock_t lock;
lock_raii_t raii(&lock);
```

저 `raii_t`는 꽤 일반적이어서, 생성과 소멸 시 특정 함수를 통해 자원 관리가 되어야 하는 class에 대해 모두 적용될 수 있다. 예를 들면 `shared_ptr` (add_ref/release_ref) 등이 될 수 있다.


[summerlight]님께서 예제로 달았던 finalizer를 raii의 예로 들어보자. 특정 scope가 끝나는 시점에 수행되어야할 작업들을 명시해주는 객체가 된다. 즉, 익명의 객체를 하나 만들고, 그 소멸자에서 수행될 함수를 인자로 받도록 한다.

먼저 소멸자에서 무언가를 수행해줄 수 있는 class를 만들어보자.

```cpp
template <typename _Func>
struct finalizer {
    finalizer(_Func&& _func)
        : func(_func) {}
    ~finalizer() {
        func();
    }
private:
    _Func func;
};
```

보다 일반적인 함수 수행을 원한다면 (일반 함수, 함수자, 멤버 함수 등) `std::function` 등을 적절히 사용하는 것도 좋겠지만 본 예제에서는 간단히 위처럼 설계했다. 위 `finalizer` class는 생성자로 받은 함수를 소멸자에서 수행하므로, 해당 객체가 소멸될 때까지 인자로 받은 함수의 수행을 미루게 된다.

이제 template argument 유추를 컴파일러에게 맡기기 위해 이 객체를 만들어주는 함수를 만들자.

```cpp
template <typename _Func>
finalizer<_Func> do_exit_scope(_Func&& func) {
    return finalizer<_Func>(std::move(func));
}
```

그러면 다음과 같이 사용이 가능해진다.

```cpp
auto f = do_exit_scope([=] () {
    // implements here!
});
```

생성된 객체가 소멸될 때 불려야한다는 것은, 불편하게도 `auto f`와 같이 명시적으로 변수를 코드로 적어줘야 한다는 이야기다. 이왕이면 이런 것 정도는 자동으로 컴파일러가 해줬으면 좋겠다, 싶으니 약간의 장난을 쳐보자.

g++은 어떻게 해야 좋을지 모르겠고, `__COUNTER__` macro가 있는 msvc기준으로 설명하겠다. `__COUNTER__`는 해당 매크로가 해석될 때마다 1씩 증가하는 predefined macro이다. 따라서 임시 변수 명을 지어주기에는 적합한 녀석이다. (대체품으로 `__LINE__`를 쓰기도 한데, 이러면 한 줄에 여러 코드를 작성할 수 없다.)

```cpp
#define __concat(a, b)      a##b
#define __auto_var          __concat(_auto_var, __COUNTER__)
#define __do_exit_scope(f)  auto __auto_var = do_exit_scope(f)
```

`__auto_var` 매크로는 자동으로 변수의 이름을 대충 지어주는 매크로다. _auto_var라는 prefix를 붙이고, 뒤에 `__COUNTER__`를 붙여서 _auto_var1, _auto_var2 등으로 해당 매크로를 사용할 때마다 이름이 알아서 지어지도록 한다.

`__COUNTER__`와 _auto_var를 붙이기 위해서 `##` 연산자를 썼다. 다만 이게 `_auto_var##__COUNTER__`처럼 사용하면 `__COUNTER__`이 문자열로 해석되므로 `__concat`와 같은 다른 macro를 만들어서 사용해야 한다.

마지막으로 `__do_exit_scope`라는 매크로 함수를 만들어서, 인자로 받은 함수에 대해 자동 변수 이름을 부여하도록 한다. 이러면 `auto f`와 같이 명시적으로 이름을 지정해주지 않아도 자동으로 변수를 할당하므로 조금이나마 더 나은 코드를 작성할 수 있다 (라는 기분이 든다-_-)

```cpp
__do_exit_scope([=] () { _tprintf_s(_T("third\n")); });
__do_exit_scope([=] () { _tprintf_s(_T("second\n")); });
__do_exit_scope([=] () { _tprintf_s(_T("first\n")); });
```

(변수의 소멸 순서는 생성 순서의 역순이므로, 출력 순서는 first - second - third 가 된다.)


raii 기법은 단순히 생성자/소멸자 쌍에서 관리 대상 객체의 특정 함수 호출 쌍을 맞춰줌으로써 자원 관리에 문제가 없도록 해주는 기법이라 정리해볼 수 있겠다.

이를 위해 자원이 사용되는 구간을 scope로 한정 짓기 위해 lambda를 사용하는 방법, 그리고 generic한 `raii_t` template class를 구현하여 사용하는 방법에 대해 간단히 알아보았다.

여기서 그치지 않고 더 나아가본다면 **raii class 를 단위 전략 기법**을 사용하여 설계하는 것이다. 간단히 설명하면,

* raii 객체가 생성자로 관리할 객체의 주소를 인자로 받는데, 그냥 자신의 멤버 변수로 가지고 있으면 안되나?
* raii 객체가 생성자, 소멸자에서 호출될 함수를 모두 template 인자로 받는데, 위의 finalizer 예제 처럼 한 쪽에 대해 아무 동작을 수행하지 않도록 할 수 있는 다른 장치를 구현할 수 없을까?
* raii 객체의 복사/대입 가능성은 전혀 고려하지 않고 있는데, 이것에 대해서는 어떻게 다루는 것이 좋을까?
* raii 객체에 대해 multi-thread에서 접근한다고 할 필요가 있을 수 있는데, 위 raii class는 그런 관점에서는 일반적이라고 하기에는 무리가 있지 않을까?

등등, storage, default template argument, ownership, thread-safety 등 몇 가지 세부 구현 전략에 대해서 더 raii class를 더 고민해볼 수 있는데, 이러한 것들을 **단위 전략(policy)** 이라고 불렀던 것이다(MC++D)

이 내용은 굉장히 흥미롭겠지만, 여백이 부족하여 더 이상 적지 않는다.