---
layout: post
title: function adapter와 type inference
tags: c++ template study -pub
---

과제는 다음의 Adapter를 만들어보자는 것이다.

```cpp
int sum(int a, int b) { return a + b; }
void main() {
    Adapter<int /* return-type */, int /* 1st-arg-type */, int /* 2nd-arg-type */>
        functor1(sum, 100 /* 1st-arg */);
    int result1 = functor1(20); // 120
    int result2 = functor1(80); // 180
}
```

많은 친구들이 이미 문제를 잘 풀었기 때문에 자세한 설명은 생략한다.

```cpp
template <typename R, typename T1, typename T2>
struct Adapter {
    typedef R (*F)(T1, T2);
    Adapter(F func, T1 arg1)
        : _function(func), _arg1(arg1) {}
    R operator () (T2 arg2) const {
        return _function(_arg1, arg2);
    }
    F _function;
    T1 _arg1;
};
```

이름 잘 지어주는 것도 물론 중요하지만 이정도 코드에서는 저정도 글자만 써줘도 이해할 것 같으니 과감히 생략.

개인적으로 풀이 중 가장 마음에 드는 것은 [Omniavinco]가 [if1live] 글에 댓글로 단 binder1st 상속을 통한 구현. (있는 것 가져다가 쓰는게 제일)

```cpp
#include <functional>
template <typename T1, typename T2, typename T3>
class Adapter:public std::binder1st< std::pointer_to_binary_function< T2, T3, T1 > > {
public:
  Adapter(T1 (*func)(T2, T3), T3 v):std::binder1st< std::pointer_to_binary_function< T2, T3, T1 > >(std::ptr_fun(func), v) {
  }
};
```

### type infererence ###

자, 과제가 끝났습니다-_-; 라고 하면 섭섭하실 것 같아 준비했습니다!

```cpp
Adapter<int /* return-type */, int /* 1st-arg-type */, int /* 2nd-arg-type */>
```

변수 선언하기 위해서 Adapter type을 길게 써야하는게 굳이 그럴 필요가 있을까? `std::make_pair`과 같은 type inference를 이용한 helper function을 구현하여 그 귀찮음을 해소해보자.

일단 function의 `return_type`, `arg1_type`, `arg2_type`을 가져오기 위해서 간단한 template 부분 특수화(partial specialization)를 사용한 `type_trait` class를 만들어보자.

```cpp
template<typename Function> struct function_traits;
template<typename R, typename T1, typename T2>
struct function_traits<R (*)(T1, T2)> {
    typedef R R;
    typedef T1 T1;
    typedef T2 T2;
};
```

위 코드는 [boost::function_traits](http://www.boost.org/doc/libs/release/libs/type_traits/doc/html/boost_typetraits/reference/function_traits.html)에서 필요한 부분만 발췌한 코드이다. 설명을 위해서 가져온 코드이고, 그냥 [boost type_traits library](http://www.boost.org/doc/libs/release/libs/type_traits/doc/html/index.html)를 가져다 쓰는게 더 좋다.

함수 type으로부터 반환 type, 인자 type들을 얻어낼 수 있게 되었으니 이제 Adapter에 넣어주기만 하면 된다. 그 부분에 대해서도 helper class를 만들어보자.

```cpp
template <typename F>
struct adapter_type {
    typedef Adapter<
        typename function_traits<F>::R,
        typename function_traits<F>::T1,
        typename function_traits<F>::T2> type;
};
```

이제 다음과 같은 방법으로 Adapter type을 간단하게 부를 수 있다.

```cpp
typedef adapter_type<decltype(my_function)>::type my_adapter;
```

이제 모든 준비가 끝났으니 Adapter 객체를 만들어주는 적절한 helper function만 만들면 된다. 이 함수의 인자로 우리가 원하는 함수 포인터를 넣으면 해당 함수에 대한 type을 template이 잘 알아서 inference 해줄 것이고, 그에 따라 적절한 Adapter class에 대한 객체가 만들어질 것이다.

```cpp
template <typename F>
typename adapter_type<F>::type make_adapter(
    F func, typename function_traits<F>::T1 arg1) {
    return typename adapter_type<F>::type(func, arg1);
}
```

`F` type으로 받은 함수에 대해 `adapter_type`의 객체를 만들어 적절히 반환해준다.

이제 다음과 같이 main 함수 내의 코드를 정리할 수 있다.

```cpp
// Adapter<int, int, int> adapter(sum, 100);
auto adapter = make_adapter(sum, 100);
std::cout << adapter1(20) << std::endl;
std::cout << adapter1(80) << std::endl;
```

### 정리 ###

간단한 레벨에서 c++스럽게 프로그래밍을 한다면 stl만 어느정도 써도 된다. 하지만 조금만 더 프로그래밍을 하다보면 쓸데없는 중복 코드를 제거하기 위한 일반적인 프로그래밍을 하게 되고, c++에서 그걸 표현하려면 template은 필요한 요소이기 때문에 익숙해지는게 좋다.

이번 과제로 나온 adapter는 어떤 함수의 interface를 다른 interface로 변환하기 위한 adapter pattern을 구현한 것이다. adapter pattern은 어떤 interface를 연결해주냐에 따라 장황한 구현의 세계가 펼쳐질 수 있는데 여기서는 간단히 함수와 함수를 연결해주는 것으로 template과 `operator ()` 만으로 구현을 한 것이다.

하지만 template을 사용하게 될 경우 그 구현체를 사용하는 쪽에서 type 노가다를 해주어야할 일이 생기는데 이걸 해결하기 위해서 auto keyword와 helper function을 통한 compiler의 type inference와 `type_traits`을 사용하는 것이다. (이번 스터디에서 type_traits는 주제를 벗어나기 때문에 다루지 않을 예정이다)

`type_traits`을 언급했으니 말인데, 위에서 만든 Adapter의 효율은 생각보다 좋지 않다.
왜냐하면 binding되는 인자와 `operator ()`의 인자로 받는 객체의 크기가 매우 클 경우 해당 객체가 복사되어 넘어가기 때문이다. 이 문제를 해결하기 위해 인자의 const-reference를 쓰는 것이 좋을지, 아니면 move semantics을 쓰는 것이 좋을지, 아니면 `shared_ptr`, 혹은 `unique_ptr`을 쓰는게 좋을지 고민해보고 그에 대한 구현을 해보는 것도 좋은 연습이 되겠다.

template의 부분 특수화와 단위 전략(unit policy)을 공부하면 충분히 일반적인 interface를 가지면서도 각 경우에 대해 효율적으로 동작할 수 있는(심지어 compile time에 모든 것이 결정되어 runtime에 추가적인 부담을 지지 않는) 구현을 할 수 있다. ~~MC++D, TMP 스터디 절찬리 예매 중..은 아니고~~

사실 오늘 구현한 내용들은 어느 정도 표준에 포함되었거나 boost에 있는 내역들이다. 따라서 다음의 구현체를 찾아보며 공부하는 것을 적극 추천한다.

* [Cppref: std::bind](http://en.cppreference.com/w/cpp/utility/functional/bind)
* [Cppref: type_traits](http://en.cppreference.com/w/cpp/header/type_traits)
* [boost: type_traits library](http://www.boost.org/doc/libs/1_54_0/libs/type_traits/doc/html/index.html")


지금까지의 내용은 compiler time에서 일어나는 generic programming 이야기였다. 이를 runtime에서 하나의 type으로 모아서 작업하기 위한 type erasure을 오늘 다룰 것이다.

그렇다면 다음 과제는 dispatcher가 될 것 같다-_-;