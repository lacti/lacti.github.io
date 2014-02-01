---
layout: post
title: template에 의한 generic interface 정의
tags: c++ template -pub
---

알고리즘 등의 일반화나 의존성 제거를 위해서 class 사이를 interface 로 쪼개는 경우가 있다.
나는 C++ 보다는 Java가 더 익숙해서 template보다는 interface나 generics를 사용하는게 더 익숙한 편이다.

그래서 저번 자료구조 숙제를 할 때도 당황했던 것이, `Iterator`나 `List` 에 대해 `Vector`나 `LinkedList`를 구현할 때, 먼저 Interface를 정의하고 그것에 대해 구현하려 했던 것이다.

```cpp
template <class T>
class Iterator {
public:
    virtual Iterator& operator ++ (void) = 0;
    virtual T& operator -> (void) = 0;
};
```

물론 더 많은 method가 필요하겠지만 이정도로 하자.

++ 연산자에 대해 overloading을 하면서 그걸 virtual로 만들고 있다. 그러면 Iterator를 상속받는 녀석은 다음과 같다.

```cpp
template <class T>
class VectorIterator : public Iterator<T> {
public:
    virtual Iterator& operator ++ (void) { /* pointing to next */ return (*this); }
    virtual T& operator -> (void) { return /* some value */; }
};
```

`VectorIterator` 객체이지만 부모 type인 `Iterator& type`으로 가리킬 수 있다. reference type이니까 가능하다.

이제 `List`를 정의한다. 이 Interface는 Iterator를 반환하는 함수가 있다.

```cpp
template <class T>
class List {
public:
    virtual Iterator ListIterator(void) = 0;
};
```

이 때 Iterator 객체에 대한 주소를 넘겨주게 되면 메모리 관리를 해줘야하는 번거로움이 있고, 상태를 갖는 객체라서 공유되면 안된다. (각각 다른 지점을 pointing 할 수 있다) 따라서 그냥 값 객체처럼 잘 캡슐화해서 Iterator 객체로 반환하는게 제일 바람직하다.

그런데 망조가 보인다. Iterator type으로 반환해야하는데 `VectorIterator`를 어떻게 반환하지?

```cpp
template <class T>
class Vector : public List<T> {
public:
    virtual Iterator ListIterator(void) { return VectorIterator(this); /* ERROR */ }
};
```

`VectorIterator` class가 `Iterator` class를 상속받았어도 단순 객체일 때는 대입이 불가능하기 때문에 저 구문은 실행이 되지 않는다. 당초에 virtual을 쓰는 것 자체가 객체의 포인터에 의해 vfptr로 다형성을 사용해서 자식이 override한 함수를 쓸 수 있도록 `subtype polymorphism`을 일으키는건데, 메모리 관리 귀찮다고 그냥 객체를 쓴다고 될 일이 아니다.

그렇다면 해당 문제를 해결하려면 어떻게 해야할까? `smart pointer` 같은거라도 끼얹나?

당초에 접근이 잘못됬다.  
동일한 interface를 만드는 이유는 해당 interface를 통해 실질적인 구현을 알 필요 없이, 실제 객체의 타입과 상관없이 그 객체를 사용하겠다는 것, 즉 의존성을 분리하겠다는 것이다.

`List`, `Iterator`를 만드는 것 자체가 순회하고자 하는 아래의 함수가 있을 때 `Vector`, `LinkedList`, `ArrayList`, `Queue`, `Deque` 중 뭐라도 그것이 동작할 수 있게 동일한 Interface를 만들어주기 위함이었던 것이다.

```cpp
void for_each (const Iterator& begin, const Iterator& end, Functor functor) {
    for (Iterator it = begin; it != end; ++it)
        functor (*it);
}
```

명시적인 `Iterator`라는 Interface가 있으면 컴파일러가 위의 코드를 명확히 검사해줄 것이고, 의존성도 줄어들 것이고, 저 함수는 가히 Generic하다고 부를 수 있을 것이고, 왠지 코딩 잘하는 것 같고, 다 좋은건가?

하지만 위에서 언급한 Iterator에 대한 문제가 여전히 해결되지 않았다. (Java는 어차피 gc가 object를 수집하니까 다 reference 형태로 돌아다녀서 상관없고, 무엇보다 원래 느려서 다형성 부담따위 고민도 안한다)

명시적으로 interface를 정의하지 않아도 template에 의해서 위 문제가 해결 가능하다.

```cpp
template <class Iterator>
void for_each (const Iterator& begin, const Iterator& end, Functor functor) {
    for (Iterator it = begin; it != end; ++it)
        functor (*it);
}
```

맨 위에 template 구문이 추가된 것 빼고는 위의 `for_each` 문과 동일하다.
이와 같이 코드를 작성할 경우 `List`, `Iterator`와 같은 명시적인 interface는 필요하지가 않다.
단지 저 `for_each`에 들어가는 type 이 ++ 연산과 * 연산만 구현되면 되는 것이다.

```cpp
template <class T>
class Vector {
public:
    class Iterator {
    public:
        Iterator& operator ++ (void);
        T& operator * (void);
    };
};
template <class T>
class LinkedList {
public:
    class Iterator {
    public:
        Iterator& operator ++ (void);
        T& operator * (void);
    };
};
```

위에서 보면 `Vector::Iterator`나 `LinkedList::Iterator` 둘 다 `operator ++` 과 `operator *` 을 갖고 있다. 비록 Java 에서처럼 두 객체가 명시적으로 동일한 interface를 포함하고 있다는 명시적 코드는 없지만, 위의 `for_each` template 함수에 들어가게 되면 컴파일러가 각각의 type에 대한 `for_each`를 만들어내면서, ++ 과 * 연산자가 정의되어있는가를 검사해준다.

즉, 명시적인 Interface가 없다면 Java 의 Generics에서는 불가능할 일이 C++에서는 어차피 컴파일러가 해당 코드를 만들어내면서 그 코드에 대해 다시 컴파일을 수행하니 가능하다는 것.  
따라서 굳이 명시적인 interface class (pure abstract class)를 만들지 않아도 template을 통해 generic이 보장될 수 있다는 것. 다만 어떤 interface 가 필요한지에 대한 명확한 문서 or 주석 or 설명이 없다면 template 컴파일 에러를 해석해서 해당 함수를 구현해야하는 지옥을 맛보겠지만 [....]

---
template이나 define에 대해서는 가끔 script 언어같이 느껴지는 것이,  
script 언어가 실행 중에 코드를 동적으로 해석하여 실행하는 것과 template이나 define macro가 컴파일 타임에 코드를 찍어내서 그걸 컴파일하여 코드를 다시 만들어내는 것이 비슷하게 느껴지기 때문이 아닐까 한다.