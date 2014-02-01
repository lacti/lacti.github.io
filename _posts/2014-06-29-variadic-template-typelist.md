---
layout: post
title: variadic template을 사용한 typelist 구현
tags: c++ template -pub
---

Modern C++ Design 책에서 소개한 typelist를 c++11 문법인 variadic template으로 구현해보자.

typelist는 type들의 list형태로 compile time에 여러 type에 대한 동일한 작업을 할 때 사용된다. 예를 들면,

- conversion table을 만들어서 부담이 적은 dynamic_cast를 구현한다던가,
- hierarchical inheritance를 통한 tuple class 구현이라던가,
- 여러 type에 대해 작성되어야 할 boilerplate 코드를 template으로 구현한다던가 할 때 사용된다.

여러 type을 list 형태로 묶기 위해서는 **개수를 알 수 없는** type 인자를 template으로 받아야 한다는 것인데, c++11 이전에는 그러한 방법이 없었기 때문에 template overloading (boost mpl)이나 typenode에 의한 linked list + macro (loki) 형태로 구현했었다.

c++11에서는 variadic template이 지원되니 이 부분을 개선해보도록 하자.

#### typenode를 사용한 구현

MC++D에서 소개된 loki 라이브러리의 Typelist는 `Typelist` template class와 `TYPELIST` macro를 사용하여 구현된다. 본 글에서는 macro가 필요없기 때문에 이름 혼동을 막기 위해 `typenode` template class와 그를 사용하는 `typelist` template class로 구현하도록 하겠다.

일단 `typenode`를 보면 다음과 같다. `typenode`는 loki 라이브러리에서 `Typelist`로 소개된 `Head`와 `Tail`을 가지고 있는 struct와 동일하다.

```cpp
template <typename Head, typename Tail>
struct typenode {
    typedef Head head_type;
    typedef Tail tail_type;
};
```

loki에서는 저 `typenode`를 사용할 경우, 인자 4개를 받는 typelist 구현을 위해서는 `TYPELIST_4`와 같은 macro를 만들어서 typenode의 linked list 형태가 만들어지도록 하였다.

```cpp
#define TYPELIST_1(T1) typenode<T1, null_type>
#define TYPELIST_2(T1, T2) typenode<T2, TYPELIST_1(T1)>
#define TYPELIST_3(T1, T2, T3) typenode<T3, TYPELIST_2(T1, T2)>
#define TYPELIST_4(T1, T2, T3, T4) typenode<T4, TYPELIST_3(T1, T2, T3)>
```

하지만 variadic template이 지원되는 c++11에서는 template 인자를 여러 개 받기 위해 저렇게 할 필요는 없다. 그냥 variadic template param을 받아서 재귀적으로 풀어주기만 하면 된다.

```cpp
template <typename... T>
struct typelist;

template <>
struct typelist<> {
    typedef null_type type;
};

template <typename Head, typename... Rest>
struct typelist<Head, Rest...> {
    typedef typenode<Head, typename typelist<Rest...>::type> type;
};
```

기존 template meta programming과 동일하게,

- 기본 템플릿(primary template)을 먼저 선언해주고,
- 종료 조건에 대한 specialization을 해주고,
- 재귀적으로 푸는 일반 항에 대해 만들어주면 된다.

그냥 수식 정의하는 것, 혹은 함수형 프로그래밍하는 것과 똑같다고 보면 된다.

그러면 일반 항에 의해 `Head`와 나머지로 type이 분리되고, 이 때마다 `typenode`에 대한 link를 재귀적으로 만들어주니 loki와 같이 번거롭게 `TYPENODE_n` macro를 정의하지 않아도 typelist를 구현할 수 있는 것이다. 이렇게 만들어진 typelist는 loki에서 구현된 typenode의 linked list 형태이므로, loki의 typelist libs를 그대로 사용할 수 있다.

다음으로 넘어가기 전에 비교를 위해 `length`, `type_at`, `visitor` 3가지 libs에 대해 살펴보자.  
먼저 `length`를 보자. length는 typelist에 들어있는 type의 개수를 세는 meta function이다. (tmp에서 사용되는 template function을 meta function이라고 한다.)

```cpp
template <typename TL>
struct length {
    static const int value = 1 + length<typename TL::tail_type>::value;
};

template <>
struct length<null_type> {
    static const int value = 0;
};
```

구현 방식은 typelist와 동일하다. 다만 primary template 형태에서 일반 항을 구현할 수 있기 때문에 일반 항과 종료 조건만 구현해주면 된다. 즉, `Tail`이 `null_type`이 될 때까지 1씩 더해가는 재귀적 구조라고 생각하면 되겠다.

특정 위치에 있는 type을 가져오는 `type_at` meta function도 동일한 방법으로 구현할 수 있겠다.

```cpp
template <typename TL, int index>
struct type_at {
    typedef typename type_at<typename TL::tail_type, index - 1>::type type;
};

template <typename Head, typename Tail>
struct type_at<typenode<Head, Tail>, 0> {
    typedef Head type;
};
```

index를 받아야 하므로 template argument가 2개(typelist와 index)이다. 두 번째 인자는 integer 값으로 이를 non-type template parameter 혹은 value-type template parameter라고 한다. 별다른 차이는 없고, 그냥 index 값이 0일 때를 종료 조건으로 그 때의 Head를 반환하도록 구현해주면 된다.

마지막으로 `visitor`를 보자. visitor는 typelist에 있는 type들을 모두 한 번씩 방문하면서 인자로 넘긴 `Delegator` meta function을 호출해주는 meta function이다.

```cpp
template <typename TL, template <class> class Delegator>
struct visitor {
    static void execute() {
        Delegator<typename TL::head_type>::execute();
        visitor<typename TL::tail_type, Delegator>::execute();
    }
};

template <template <class> class Delegator>
struct visitor<null_type, Delegator> {
    static void execute() {}
};
```

역시 구현 방법은 동일하다. `Delegator`는 type을 template 인자로 받아야 하기 때문에 template class가 되어야 하고, 이 때문에 visitor의 template 인자가 template template class가 된다는 점만 좀 다르다.  
`visitor::execute()`에서는 typelist를 풀어서 Head를 `Delegator::execute()`로 넘겨서 호출해주고, 남은 대상들을 재귀적으로 호출해주도록 구현되어 있다. 이 때 재귀적으로 구성될 것 같은 함수 구조는 template engine이 다 풀어서 실제로는 그냥 `Delegator::execute()` 함수가 연속적으로 불리는 코드가 생성된다. (즉 runtime 부담이 최소화된다)

#### typenode 없는 typelist 구현

typenode가 없다는 것은 재귀적으로 구성된 node에 의한 list가 아닌 variadic template param을 보존하고 있는 list 형태로 구현한다는 것이다. 예를 들어 `typelist<short, int>`를 구현한다고 하면,

- typenode 기반일 경우 `typenode<short, typenode<int, null_type>>`와 같이 구성된다면,
- 이번에는 `typelist<short, int>`와 같이 구성되는 것을 말하는 것이다.

이렇게 구현할 경우 list를 어떻게 유지할 것이며, 각 지점의 type을 어떻게 접근할 수 있을지 고민해야 한다. 왜냐하면 tmp는 재귀적으로 알고리즘을 작성해야 하기 때문이다.

일단 이는 간단히 다음과 같이 구현해볼 수 있다.

```cpp
template <typename... Types>
struct typelist;

template <typename First>
struct typelist<First> {
    typedef typelist<First> type;
    typedef null_type next;
    typedef First current;
};

template <typename First, typename... Rest>
struct typelist<First, Rest...> {
    typedef typelist<First, Rest...> type;
    typedef typename typelist<Rest...> next;
    typedef First current;
};
```

구현하는 방식은 위에서 언급했던 것과 크게 다르지 않다. primary template을 만들고, 종료 조건에 대해 구현하고, 일반 항을 구현한다.

- 처음 typelist와 interface를 맞추기 위해 type으로 자기 자신을 가리키도록 했다.
- 지금 인자를 제외한 남은 template 인자들로 다음 list를 가리키기 위한 next를 만들었다.
- 지금 인자를 가져오기 위한 current를 만들었다.

그럼 이제 meta function들은 `next`를 타고 이동하고 `current`를 선택하면서 구현하면 되겠다.
`length`를 보자.

```cpp
template <typename List>
struct length {
    static const int value = 1 + length<List::next>::value;
};

template <>
struct length<null_type> {
    static const int value = 0;
};
```

typenode 때와 동일하다. `tail_type` 대신 `next`로 재귀한다고 생각하면 된다.

`type_at`과 `visitor`도 동일하다.

```cpp
template <typename List, int index>
struct type_at {
    typedef typename type_at<typename List::next, index - 1>::type type;
};

template <typename List>
struct type_at<List, 0> {
    typedef typename List::current type;
};

template <typename List, template <class> class Delegator>
struct visitor {
    static void execute() {
        Delegator<typename List::current>::execute();
        visitor<typename List::next, Delegator>::execute();
    }
};

template <template <class> class Delegator>
struct visitor<null_type, Delegator> {
    static void execute() {}
};
```

이상으로 간단히 typenode 없는 typelist를 구현해 보았다.

#### 정리

전자와 후자의 가장 큰 차이점은 typenode에 의한 재귀적 list냐 아니면 variadic template 인자에 의한 선형적 list냐의 차이라고 생각된다. 이를 기반으로 수행하는 meta function들은 어차피 재귀적으로 수행되므로, 아마도 둘의 차이는 compile 시 소모되는 메모리 양이 되지 않을까 한다. 아마도 후자의 메모리 소모량이 더 적지 않을까 한다.  
또한 debugging을 위해 typelist의 typename을 출력해보면 후자가 보기 좋기 때문에 후자가 더 좋아보이기도 한다.

그러면 이제 typelist를 수정하는 meta function들을 구현해야 하는데 그건 다음에 해보도록 하겠다.

- [Stackoverflow: Variadic variadic template templates](http://stackoverflow.com/questions/9662632/variadic-variadic-template-templates)
- [Stackoverflow: Merge two variadic templates in one](http://stackoverflow.com/questions/16648144/merge-two-variadic-templates-in-one)
