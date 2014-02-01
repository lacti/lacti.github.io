---
layout: post
title: template 프로그래밍과 type erasure
tags: c++ template study -pub
---

```cpp
template <typename _Iter, typename _FuncTy>
void for_each(_Iter begin, _Iter end, _FuncTy functor) {
    for (; begin != end; ++begin) {
        functor(*begin);
    }
}
void ForEach(Iterator* iter, const Functor& functor) {
    while (iter->MoveNext()) {
        functor.DoIt(iter->Current());
    }
}
```

* 첫 번째 코드(`for_each`)는 `_Iter`, `_FuncTy`에 들어가는 각 type에 맞게 compile time에 모든 code가 생성(template instantiation)되어 어떤 함수가 호출될지 compile time에 결정되는 구조이고,
* 두 번째 코드(`ForEach`)는 `Iterator`와 `Functor` interface를 구현한 객체가 runtime에 `ForEach()` 함수로 넘어간 다음 virtual function call이 불려서 runtime에 어떤 함수가 호출될지 결정되는 구조이다.

즉, `ForEach` 함수는 1개이지만 `for_each` 함수는 부르는 type에 따라서 여러 개가 될 수 있다는 것이다. `ForEach` 함수는 내부에서 vfptr에 의한 함수 호출 부담이 야기되지만, `for_each` 함수는 그런 것 없다. (즉, 늦어도 linking time에 실제 호출될 함수의 주소가 binding된다)


template으로 일반화된 프로그래밍을 하는 것은 좋은데 문제는 결과물이 복잡한 template type으로 표현된다는 것이다. 그 부분을 모두 손으로 작성하는 type 노가다를 막기 위해 helper function에 의한 type inference를 사용한다고 해도 결국 애매한 상황이 발생한다.

```cpp
int my_func(int a, int b) { return 0; }
void main() {
    auto adapter = make_adapter(my_func, 100);
    process(adapter);
}
void process(??? adapter) {}
```

위 코드에서 process는 adapter를 인자로 받아서 무언가 작업을 수행해야 하는데 이 시점에서 결국 adapter의 full-name이 다시 한 번 등장해야 한다.

위 문제를 좀 더 일반화시켜서, **int 1개를 인자로 받고 int를 반환하는 함수**를 `process()` 함수가 받아서 처리한다고 생각해보자. 간단히 `int (*)(int)`의 function pointer만 생각할 수도 있겠지만 위 예제 코드에서 나온 adapter도 `int (int)`의 signature를 가지고 있기 때문에 이 역시 저 함수의 인자로 넘어갈 수 있어야 한다.

가장 간단한 방법은 `process()` 함수 역시 template으로 만드는 것이다.

```cpp
template <typename _FuncTy>
void process(_FuncTy func) {
    int result = func(100);
}
```

그러면 function pointer가 들어가든, adapter 객체가 들어가든, lambda가 들어가든 아니면 뭐 다른 뭔가가 들어가든 그에 맞게 알아서 `process()`의 함수가 만들어질 것이고 코드는 문제 없이 실행될 것이다.

template에 의해서 코드가 모두 header에 붙어있어 컴파일된 코드 결과물이 크고 아름다워지기 때문에 위 함수를 cpp로 내리기 위해서 template을 안 쓰고 문제를 해결하고 싶을 수 있다. 물론 그렇지 않다고 하더라도 `process()` 함수에서 바로 functor를 받아서 처리하는 구조가 아니라, map 같은 곳에 저장해놨다가 추후에 호출하는 경우라면 해당 객체의 호출 시점에 runtime으로 미루어지니 compile time에 코드가 만들어지는 template으로는 답이 없다.

```cpp
void register_all() {
    table[1] = function_1; // register function pointer
    table[2] = my_adapter; // register adapter object
    table[3] = [] (int a { return a + 1; }; // register lambda
}
void process(int optype, int arg) {
    int result = table[optype](arg);
}
```

위와 같은 경우에는 table이라는 자료 구조에 int key과 뭔가 `int (int)` 형태의 호출 signature를 갖는 대상을 저장해두어야, 추후 `process()` 함수가 호출될 때 table에서 적절한 호출 객체를 꺼내서 부를 수 있게 될 것이다.

즉, **요약하면 모든 일반화된 `int (int)` 호출자에 대해서 동일하게 지칭할 수 있는 객체를 만들어야 하는 것**이다.

### generic functor: int (int) ###

runtime에 호출될 대상이 결정되기 위해서 virtual function call을 사용한다고 하였다. 그렇다면 먼저 `int (int)`에 대한 interface를 정의하여 virtual function call을 사용할 수 있도록 해보자.

```cpp
struct functor_ii_inf {
    virtual int operator () (int) =  0;
};
```

이제 호출할 대상들이 저 interface를 구현하기만 하면 된다. 이는 template으로 간단히 표현할 수 있다.

```cpp
template <typename F>
struct functor_ii_impl : public functor_ii_inf {
    functor_ii_impl(F func) : _func(func) {}
    virtual int operator () (int arg1) {
        return _func(arg1);
    }
    F _func;
};
```

`functor_ii_inf` interface를 구현하여 operator가 virtual이 된 것을 빼면 지난 번 Adapter class와 다를 것이 별로 없다.

지난 2차 과제 풀이에서 썼듯이 위와 같이 `functor_ii_impl`를 그대로 사용하려면 각 호출자를 집어넣어 생성할 때마다 그에 대한 type을 매번 명시해주어야 한다.

```cpp
functor_ii_inf* inf1 = new functor_ii_impl<Adapter<int, int, int>>(my_adapter);
```

이는 매우 불편한 작업이므로 helper function을 사용하여 생성 부분을 좀 단순화해보자.

```cpp
template <typename F>
functor_ii_inf* make_functor_ii(F func) {
    return new functor_ii_impl<F>(func);
}
```

이제 다음과 같이 사용할 수 있다.

```cpp
std::map<int, functor_ii_inf*> table;
void register_all() {
    table[1] = make_functor_ii(function_1);
    table[2] = make_functor_ii(my_adapter);
    table[3] = make_functor_ii([] (int a { return a + 1; });
}
```

template으로 인해 생성된 여러 type을 interface 상속을 통해 제거하고, `functor_ii_inf`라는 하나의  추상화된 type으로 지칭하게 되었다. 이것을 **type erasure**라고 한다.


위와 같은 방법으로 구현하게 되어도 큰 문제가 없을 수 있지만 `functor_ii_inf*` 객체에 대한 메모리 해제를 해줄 주체에 대한 귀찮음이 있다.
이를 `std::shared_ptr`을 써서 간단히 해결하는 것도 좋은 방법이다.

```cpp
typedef std::shared_ptr<functor_ii_inf> functor_ii;
```

여기까지 구현한 내용을 하나로 묶어서 관리해주면 이번 과제를 하기 위해 template을 붙일 때 아주 좋을 것 같다.

```cpp
struct functor_ii {
private:
    struct inf {
        virtual int operator () (int) = 0;
    };
    template <typename F>
    struct impl : public inf {
        impl(F f)
            : _f(f) {
        }
        virtual int operator () (int a) {
            return _f(a);
        }
        F _f;
    };
public:
    template <typename F>
    functor_ii(F f)
        : _inf(new impl<F>(f)) {
    }
    int operator () (int a) {
        return (*_inf)(a);
    }
    std::shared_ptr<inf> _inf;
};
```

* `functor_ii` class는 template이 안 붙어있는 일반 class이다. 즉 1개의 type이다. 대신 생성자가 template function이며 멤버 변수인 `_inf`에 적절한 `impl` 객체를 넣어준다.
* `inf` class는 필요한 interface를 정의하고 있고, `impl`에서는 호출가능한 `int (int)` 형태를 인자로 받아 멤버 변수에 갖고, `operator ()` 함수에서 그것을 불러주는 template class이다.

즉, `functor_ii`는 모든 `int (int)`에 대응할 수 있는 실제 template class인 `impl`을 `inf` interface로 가리키고 있는 객체인 것이다. 그리고 `inf` 객체를 `shared_ptr`로 가지고 있기 때문에 메모리도 잘 관리가 된다.

한가지 재밌는 것은 아까 만들었던 `make_functor_ii()` helper function과 다르게 `functor_ii` class는 implicit한 생성자를 가지고 있기 때문에 register를 수행할 때 단순 대입만 해도 된다.

```cpp
std::map<int, functor_ii> table;
void register_all() {
    table[1] = function_1; // functor_ii(function_1); 과 같다.
    // 생략
}
```

이렇듯 template으로 최대한 일반화된 프로그래밍을 하고, 이 수행 흐름을 runtime까지 끌어올 일이 있다면 적절히 type erasure 기법을 써서 프로그래밍을 해주면 되겠다. 사실 위 구현체는 [std::function](http://en.cppreference.com/w/cpp/utility/functional/function)에 구현되어 있으니 이를 가져다 쓰는 것이 제일 좋다.

### 과제 1: dispatcher ###

간단한 dispatching 시스템을 구현해보자. message-id에 대응되는 message-handler가 호출되면 된다. 단 message-handler는 단순 function pointer일수도 있고, lambda function일 수도 있고, functor일 수도 있다. 대충 호출 가능한 대상을 다 받자.

```cpp
struct message_t {};
std::map<int /* op-code */, handler<void, const message_t&>> table;

void dispatch(int op_code, const message_t& message) {
    table[op_code](message);
}
```

`handler` class는 적절히 위 예제(`functor_ii`)를 고쳐서 만들어보자. 다만 반환 type과 인자 type을 template 인자로 받도록 한다. 테스트 message와 handler는 대충 작성해도 된다.

물론 `std::function`을 쓰면 간단히 해결되지만 연습 차원에서 위 진행 과정을 이해하면서 직접 프로그래밍 해보자.

### 과제 2: class factory ###

과제가 하나면 섭섭하니 시간이 남는다면 다음의 것도 구현해보자. string으로 class의 객체를 생성할 수 있는 reflection의 class factory를 구현해보자.

```cpp
class interface_t {
public:
    void execute() = 0;
};
class test_class_1 : public interface_t {
public:
    void execute() {
        std::cout << "class_1" << std::endl;
    }
};
class test_class_2 : public interface_t {
public:
    void execute() {
        std::cout << "class_2" << std::endl;
    }
};
void main() {
    auto* obj = (interface_t*)new_instance("test_class_2);
    obj->execute();
}
```