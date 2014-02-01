---
layout: post
title: type_t class 도입을 통한 임시 객체 없는 type 분기
tags: c++ template -pub
---

어떤 class 2개가 있다.

```cpp
class big_class {};
class huge_class {};
```

이 class들은 기본 생성자에서 굉장히 복잡한 작업을 하는 객체들 혹은 생성 자체가 복잡한 class들이다. 이러한 class에 대해 어떠한 작업을 수행하는 generic한 함수가 있다.

```cpp
template <typename _Ty>
void operation() {}
```

이 함수는 객체의 type을 받아서 내부에서 모종의 작업을 수행하게 된다. 따라서 메인 함수에서는 다음과 같이 각 class에 대해 operation을 요청하게 된다.

```cpp
int _tmain(int argc, _TCHAR* argv[]) {
    operation<big_class>();
    operation<huge_class>();
    return 0;
}
```

(굳이 객체를 넘기지 않은건 이 예제에서는 별로 그럴 필요가 없기 때문이다.)

operation 내에서는 각 type별로 type의 이름을 출력해주는 `print`라는 함수를 호출한다고 하자. 그러면 간단하게 template의 specialization을 사용하여, `print` 함수는 다음과 같다고 생각할 수 있다.

```cpp
template <typename _Ty>
void print(Ty&) {}

template <typename _Ty>
void print(big_class&) {
    printf_s("big_class\n");
}

template <typename _Ty>
void print(huge_class&) {
    printf_s("huge_class\n");
}
```

specialization을 하기 위해 함수 interface에 인자로 받을 객체를 추가했다. 덕분에 각 type 별로 함수가 구분되기는 했지만, 저 함수를 부르려면 일단 객체를 만들어야하는 부담이 생긴다.

```cpp
template <typename _Ty>
void operation() {
    print(_Ty());
}
```

`big_class`와 `huge_class`는 기본 생성자에서 굉장히 많은 일을 하는 무거운 class이다. 따라서 실제 객체를 쓰지도 않는 `print` 함수를 위해 임시 객체를 만드는 것은 굉장히 낭비스러운 일이다. 또한, 저 operation 함수가 generic 해야함을 고려해볼 때, 저 함수를 사용하는 모든 class 들이 ~~임시 객체를~~기본 생성자를 갖는다고 가정하는 것은 전혀 generic하지 않은 생각이다.

이 문제를 해결하기 위해서는, `print` 함수에 객체를 넘기는 것이 아니라 객체의 type을 넘기는 방법을 사용하면 된다. c++ template meta programming 책에서는 이에 대해서, **간접층을 도입하여 문제를 해결할 수 있다** 라고 소개한다.

먼저 type 정보를 위한 template class를 도입한다.

```cpp
template <typename _Ty>
class type_t {
    typedef _Ty type;
};
```

단순히 저 class를 사용하는 것만으로 위 문제가 깔끔하게 해결된다. 이제 `print` 함수는 실제 객체의 type을 인자로 넣는 것이 아니라 `type_t`를 인자로 받는다.

```cpp
template <typename _Ty>
void print(type_t<_Ty>&) {}

template <>
void print(type_t<big_class>&) {
    printf_s("big_class\n");
}

template <>
void print(type_t<huge_class>&) {
    printf_s("huge_class\n");
}
```

`print` 함수의 인자는 이제 `type_t`의 객체이지 실제 `big_class`와 `huge_class`의 객체가 아니다. 그리고 `type_t` class 는 아무런 멤버 변수도 갖지 않는 매우 가벼운 임시 객체를 생성할 수 있다. (typedef 정보만 갖기 때문에 컴파일러가 최적화하여 아무런 임시 객체를 만들지 않고 바로 함수를 호출하도록 linking을 할 것이다)

이제 operation 함수는 무거운 `big_class`와 `huge_class`에 대한 임시 객체를 만드는 대신, 각 type 에 대한 `type_t` 객체를 만들어서 `print` 함수에게 넘겨주면 된다.

```cpp
template <typename _Ty>
void operation() {
    print(type_t<_Ty>());
}
```

다음은 코드 전문이다.

```cpp
class big_class {};
class huge_class {};

template <typename _Ty>
class type_t {
    typedef _Ty type;
};

template <typename _Ty>
void print(type_t<_Ty>&) {}

template <>
void print(type_t<big_class>&) {
    printf_s("big_class\n");
}

template <>
void print(type_t<huge_class>&) {
    printf_s("huge_class\n");
}

template <typename _Ty>
void operation() {
    print(type_t<_Ty>());
}

int _tmain(int argc, _TCHAR* argv[]) {
    operation<big_class>();
    operation<huge_class>();
    return 0;
}
```

template의 specialization이 들어가면 컴파일 순서에 따라 문제가 발생할 여지가 있다. 예를 들어 위 예제에서 operation 함수가 실제 구현되는 부분은 main 함수가 컴파일 될 때이다.

`operation<big_class>`가 컴파일 될 때 `big_class` type에 대한 operation 함수의 코드가 만들어진다고 보면 되고, 이 때 `print(type_t<big_class>());` 구문을 생성하게 된다. 이 시점에서

```cpp
template <>
void print(type_t<big_class>&)
```

함수를 컴파일러가 알지 못한다면, 컴파일러는

```cpp
template <typename _Ty>
void print(type_t<_Ty>&)
```

의 코드만 보고 직접 `big_class`에 대한 `print` 함수 또한 만들어버릴 것이다.

즉, 컴파일러가 특수화된 template 함수를 미처 보지 못하면 그 template 함수의 원형을 통해 필요한 type 의 함수를 만들어버리게 되므로 의도치 않은 동작을 할 수 있다. 즉, 위와 같은 코드를 작성할 때에는 컴파일러가 읽게되는 순서를 주의해야 한다는 것이다. (이에 대한 설명은 추후에 다시 하도록 하겠다)


함수의 overload처럼 template 함수도 동일한 interface로 generic한 일관성을 지키며, 필요한 각 부분에 대해 specialization을 통해 최적화된 함수를 구현할 수 있다. overload 된 함수는 모두 컴파일 대상이지만, template 함수는 실제 사용되기 전까지는 컴파일조차 되지 않는다. 이러한 장점을 이용하여 무슨 짓을 할 수 있는지 차차 알아보도록 하자.
