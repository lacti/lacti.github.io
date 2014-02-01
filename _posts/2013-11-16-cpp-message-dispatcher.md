---
layout: post
title: c++ message dispatcher
tags: c++ template study -pub
---

간단한 message dispatch 코드를 c++로 구현해보자. 일단 `std::function`을 안 쓰고 구현해보고, 그 다음에 `std::function`을 써서 구현해보자.

지난 번 글에서 `functor_ii`로 `handler_t`의 근간을 이미 설명했다.

```cpp
template <typename R, typename T>
struct handler_t {
    handler_t()
        : _impl(nullptr) {
    }
    template <typename F>
    handler_t(F f)
        : _impl(new impl_t<F>(f)) {}

    R operator () (T arg) const {
        return (*_impl)(arg);
    }
private:
    struct wrapper_t {
        virtual R operator () (T arg) const = 0;
    };
    template <typename F>
    struct impl_t : public wrapper_t {
        impl_t(F f)
            : _f(f) {}
        virtual R operator () (T arg) const {
            return _f(arg);
        }
        F _f;
    };
    std::shared_ptr<wrapper_t> _impl;
};
```

interface인 `wrapper_t`, 실 구현체인 `impl_t`, 그리고 그것을 멤버로 갖는 type erasure가 적용된 대표 type인 `handler_t`이다. 1개의 인자와 반환 값을 가질 수 있으므로 이를 template parameter인 `R`과 `T`로 표현한 것이다.

각 message handler가 받을 message의 최상위 class를 만들고, 추후 코딩을 편하게 하기 위해 handler에 대한 typedef를 걸어준다.

```cpp
struct message_t {
    virtual ~message_t() {}
};
typedef handler_t<void, const message_t&> msg_handler_t;
```

이제 모든 작업이 완료되었다. `msg_handler_t`에 대한 [unordered_map](http://en.cppreference.com/w/cpp/container/unordered_map) 객체 만들고, 적절히 불러주기만 하면 된다.

```cpp
std::unordered_map<int, msg_handler_t> __handler_table;
void dispatch(int opcode, const message_t& msg) {
    __handler_table[opcode](msg);
}
```


`std::function`을 사용할 경우 template parameter만 function type으로 넣어서 `msg_handler_t`에 대한 typedef을 바꿔주면 된다.

```cpp
typedef std::function<void (const message_t&)> msg_handler_t;
```

표준 라이브러리에서 인자를 저렇게 받는 이유는 저 표현식이 단순히 반환 타입, 인자 타입을 나열하는 것에 비해 더 가독성이 좋다고 판단했기 때문이다. 저렇게 받은 인자는 내부에서 `function_traits`에 의해 다시 반환 타입과 인자 타입이 분리되어 결국 `handler_t`와 같은 구현을 하게 된다.


위와 같이 코드를 구현하면 조금 아쉬운 점이 있다. 예를 들어 `message_t`를 상속받은 `int_msg_t`와 `string_msg_t`가 있다고 하자. 그리고 이를 처리하는 `int_msg_handler`, `string_msg_handler`가 있을 때 코드는 다음과 같다.

```cpp
void int_msg_handler(const message_t& m) {
    const int_msg_t& msg = static_cast<const int_msg_t>(m);
    // do something with int_msg
}
void string_msg_handler(const message_t& m) {
    const string_msg_t& msg = static_cast<const string_msg_t>(m);
    // do something with string_msg
}
enum msg_id {
    int_msg_id,
    string_msg_id,
};
void main() {
    __handler_table[int_msg_id] = int_msg_handler;
    __handler_table[string_msg_id] = string_msg_handler;
}
```

* 먼저, 각 handler의 type은 모두 `void (const message_t&)` 이기 때문에 실제 우리가 원하는 type으로 인자를 받을 수가 없다. 따라서 매번 casting해주는 과정이 필요하다.
* 그리고 각 msg가 추가될 때마다 `msg_id` 값을 정의해주어야 한다.
* 마지막으로 구현한 handler를 handler_table에다가 등록해주는 코드를 작성해야 한다.

일단 `msg_id` 문제를 해결해보자. 여러가지 방법이 있겠지만 귀찮으니 [type_index](http://en.cppreference.com/w/cpp/types/type_index)를 사용하자.

```cpp
std::unordered_map<std::type_index, msg_handler_t> __handler_table;
```

`message_t`를 받는 함수와 원하는 type을 받는 함수를 분리하고, `__handler_table`에 함수를 프로그램 시작 시에 등록하기 위해 static 전역 변수를 사용해 코드를 정리하면 다음과 같다.

```cpp
template <typename _Ty>
const _Ty& cast(const message_t& msg) {
    return static_cast<const _Ty&>(msg);
}
static void int_msg_handler(const int_msg_t& msg);
static void _int_msg_wrapper(const message_t& m) {
    int_msg_handler(cast<int_msg_t>(m));
}
static void int_msg_handler(const int_msg_t& msg) {
    // do something with int_msg_t
}
static struct _table_register_t {
    _table_table_t() {
        __handler_table.insert(std::make_pair(
            std::type_index(typeid(int_msg_t)), _int_msg_wrapper));
    }
} __register1;
```

일단 편하게 message를 casting하기 위한 cast 함수를 만들었다. 그냥 const reference 지키면서 static_cast를 해주는 함수이다.

* dynamic_cast를 하지 않은 이유는 항상 올바른 type만 casting을 요청할 것이라는 믿음을 갖고 불필요한 검사를 피하기 위함이다
* `_Ty`가 정말 `message_t`를 상속받았는지 보려면 [std::is_base_of](http://en.cppreference.com/w/cpp/types/is_base_of)를 쓰면 되겠다.

실제 작업을 수행할 함수인 `int_msg_handler`를 선언한다. 그리고 전달 함수인 `_int_msg_wrapper` 함수를 작성한다. `_int_msg_wrapper` 함수에서는 `message_t`를 `int_msg_t`로 casting만 해서 `int_msg_handler` 함수로 넘겨준다. 그리고 실질적인 작업은 `int_msg_handler`에서 `int_msg_t`를 인자로 받아 처리하게 된다.

프로그램 시작과 동시에 `__handler_table`에 등록하는 가장 좋은 방법은 전역 객체의 생성자를 사용하는 방법이다. 전역으로 정의된 객체의 생성자는 프로그램 시작 시에 호출된다는 점을 이용하는 것이다. 따라서 전역 객체 `__register1`를 정의한다. 그러면 프로그램 시작 시 `_table_register_t`의 생성자가 호출되고, 그 생성자에서 `__handler_table`에게 `int_msg_t`에 대한 `type_index`와 `_int_msg_wrapper`를 넣어주면 된다.

그런데 위 코드를 보면 `int_msg_t`에 해당하는 부분을 `string_msg_t`로 치환했을 때, `string_msg_t`를 위해서도 사용할 수 있는 것을 확인할 수 있다. 즉, **대부분의 코드가 무의미하게 반복된다는 것이다**. 이러한 boilerplate code를 적절히 제거하기 위해 반복되는 부분을 다음과 같이 macro로 묶어내자.

```cpp
template <typename _Ty>
struct table_register_t {
    table_register_t(msg_handler_t handler) {
        handler_table().insert(std::make_pair(std::type_index(typeid(_Ty)), handler));
    }
};
#define HANDLER(msg_type) \
    static void msg_type##_handler(const msg_type& msg); \
    static void _##msg_type##_wrapper(const message_t& m) { \
        msg_type##_handler(cast<msg_type>(m)); \
    } \
    static table_register_t<msg_type> __reg_##msg_type##(_##msg_type##_wrapper); \
    static void msg_type##_handler(const msg_type& msg)
```

이제 다음과 같이 사용할 수 있다.

```cpp
struct int_msg_t : public message_t {
    int a, b;
};
HANDLER(int_msg_t) {
    std::cout << msg.a + msg.b << std::endl;
}
```

이제 message를 하나 만들어서 날려보자. 이를 처리하는 dispatch 함수는 다음과 같이 간단하게 작성할 수 있다.

```cpp
template <typename _Ty>
void dispatch(const _Ty& msg) {
    __handler_table[std::type_index(typeid(_Ty))](msg);
}

void main() {
    int_msg_t msg;
    msg.a = 100;
    msg.b = 20;
    dispatch(msg);
}
```

아무 message 객체나 받아서 그 `type_index`로 적절한 handler를 
찾고, 그 handler에게 message 객체를 넘겨서 처리될 수 있도록 하는 것이다.

하지만 위 코드에는 문제가 있다. 전역 `table_register_t` 객체와 `__handler_table` 객체가 다른 번역 단위에 있을 경우, 두 객체의 생성자가 불리는 시점이 undefined이기 때문에 아직 `__handler_table` 객체가 초기화되지 않은 시점에서 register를 수행하다가 프로그램이 죽는 문제이다.

이 문제를 해결하는 가장 쉬운 방법은 `handler_table` 객체를 전역 변수 말고 singleton으로 만드는 것이다. 원칙적으로 singleton 객체는 처음 접근할 때 생성되기 때문에, 어떤 register 객체든 `handler_table` 객체를 처음 접근하는 때 `handler_table` 객체를 생성하게 되니 위 문제를 해결할 수 있다.

그리고 c++11에서는 간단하게 singleton을 구현할 수 있다.

```cpp
inline handler_table_t& handler_table() {
    static handler_table_t _handler_table;
    return _handler_table;
}
```

코드 전문은 다음과 같다.

```cpp
struct message_t {
    virtual ~message_t() {}
};

typedef std::function<void (const message_t&)> msg_handler_t;
typedef std::unordered_map<std::type_index, msg_handler_t> handler_table_t;

inline handler_table_t& handler_table() {
    static handler_table_t _handler_table;
    return _handler_table;
}

template <typename _Ty>
inline const _Ty& cast(const message_t& msg) {
    return static_cast<const _Ty&>(msg);
}

template <typename _Ty>
struct table_register_t {
    table_register_t(msg_handler_t handler) {
        handler_table().insert(std::make_pair(std::type_index(typeid(_Ty)), handler));
    }
};

#define HANDLER(msg_type) \
    static void msg_type##_handler(const msg_type& msg); \
    static void _##msg_type##_wrapper(const message_t& m) { \
        msg_type##_handler(cast<msg_type>(m)); \
    } \
    static table_register_t<msg_type> __register_##msg_type##(_##msg_type##_wrapper); \
    static void msg_type##_handler(const msg_type& msg)

template <typename _Ty>
inline void dispatch(const _Ty& msg) {
    handler_table()[std::type_index(typeid(_Ty))](msg);
}
```

그리고 main 함수에서는 다음과 같이 사용한다.

```cpp
struct int_msg_t : public message_t {
    int a, b;
};
HANDLER(int_msg_t) {
    std::cout << msg.a + msg.b << std::endl;
}

void main() {
    int_msg_t msg;
    msg.a = 100;
    msg.b = 20;
    dispatch(msg);
}
```

### 정리 ###

이번 과제에서는 간단하게 c++의 message dispatch 코드를 구현해보았다. 위와 같은 코드는 queue를 붙여서 message pattern이나 event pattern을 구현할 때 쓰이거나 네트워크를 붙여서 서버의 packet dispatch 코드로도 사용된다. 언듯 보면 복잡해보일 수도 있으나 실상은 function map이고, 여기저기서 자주 만나게 될 개념이니 이번 기회에(?) 익숙해지도록 하자.

추가 과제였던 reflection 과제에 대한 풀이는 예전에 작성한 글에 대한 링크로 대신하겠다.

* [c++에서 reflection 사용하기 2]({% post_url 2012-06-04-using-reflection-at-cpp-2 %})
* [c++에서 reflection 사용하기 3]({% post_url 2012-06-09-using-reflection-at-cpp-3 %})