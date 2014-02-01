---
layout: post
title: 멤버 데이터 포인터를 사용하여 연산식 묶어내기 2
tags: c++ refactor -pub
---

이번 글에서는 `Stat` 자료구조 내에 배열이 있을 때 이를 어떻게 처리할지에 대해서 알아보도록 하자.

`Stat` 코드를 작성하다보니, 이동 속도에 관해서는 각각의 변수를 따로 두는 것 보다, 배열 하나로 처리하는 것이 더 낫다는 것을 깨닫게 되었다.

```cpp
enum MovingStatType {
    MST_WALK,
    MST_RUN,
    MST_RIDE,
    MST_MAX
};
struct Stat {
    float hp;
    float movingSpeed[MST_MAX];
```

배열로 묶어서 `movingSpeed` 관련 코드가 개선된 것까지는 좋았는데 `hp`와 `movingSpeed`는 type이 다르기 때문에 이전 글에서의 방법을 더 이상 사용할 수 없게 되었다. 둘의 type을 비교해보면 아래와 같다.

```cpp
typedef float Stat::*DataPtr;
typedef float (Stat::*ArrayPtr)[3];
```

어쨌든 두 타입이 완전히 달라졌기 때문에, 이를 일치시키지 못한다면 또 다시 switch-case의 지옥을 맛보게 될 것이다. 멤버 데이터 포인터 수준에서는 이를 해결할 수 없기 때문에 **멤버 함수 포인터**를 사용하여 문제를 해결 할 것이다.

목표는 그냥 멤버 변수와 배열 멤버 변수의 **접근 interface를 통일시키는 것**이다. 멤버 함수 포인터를 사용할 것이니 함수의 signature는 같아야 한다는 것이다.

위 `Stat` 구조체에서는 다음과 같이 생각해볼 수 있다.

```cpp
struct Stat {
    float& Hp() { return hp; }
    float& WalkSpeed() { return movingSpeed[MST_WALK]; }
    float& RunSpeed() { return movingSpeed[MST_RUN]; }
    float& RideSpeed() { return movingSpeed[MST_RIDE]; }
```

이제 위 함수들은 다음의 멤버 함수 포인터로 지칭이 가능하다.

```cpp
typedef float& (Stat::*Accessor)();
```

하지만 모든 멤버 변수에 대해서 저렇게 함수를 만들어주는 것은 여간 고역이 아니다. 이런 일을 사람이 하는 것은 도의에 어긋나니, 컴파일러가 이 일을 대신하도록 해보자.

```cpp
struct Stat {
    float& Hp() { return hp; }
    template <int _Index>
    float& MovingSpeed() { return movingSpeed[_Index]; }
```

template 함수를 사용해서 배열의 인자를 template으로 넘겼다. 저 `_Index` 값으로 `MST_WALK` 등의 값을 넘기면 그에 해당하는 `MovingSpeed<>` 함수를 컴파일러가 알아서 생성해줄 것이다.

**이렇게 생성된 template 함수들의 interface도 위에서 정의한 Accessor에 부합된다. 이것이 핵심 아이디어이다.**

```cpp
Accessor acc1 = &Stat::MovingSpeed<MST_WALK>;
Accessor acc2 = &Stat::MovingSpeed<MST_RUN>;
```

Stat의 각 멤버에 대해 노출 함수를 만들어주는 것은 지겨운 일이다. 이 함수들 역시 template으로 묶어보자.

```cpp
struct Stat {
    template <float Stat::*_DataPtr>
    float& Access() { return this->*_DataPtr; }
```

Access 함수는 멤버 데이터 포인터를 template 인자로 받는다. 이 역시 위에서 정의한 Accessor 타입에 부합된다.

```cpp
Accessor acc3 = Stat::Access<&Stat::hp>;
```

배열의 멤버 데이터 포인터를 template 인자로 받으려면 약간 까다로운데, 그 이유는 배열의 멤버 데이터 포인터의 타입을 명시할 때에는 그 배열의 크기가 필요하기 때문이다.

```cpp
struct Stat {
    template <size_t _Size, float (Stat::*_ArrayPtr)[_Size], int _Index>
    float& Access() { return (this->*_ArrayPtr)[_Index]; }
```

배열 타입 명시를 위한 배열의 크기, 멤버 데이터 포인터 값, 그리고 배열 내의 index. 이렇게 3개의 template 인자를 받는다. 이 함수를 사용하여 acc1, acc2를 다시 정의해 본다면 다음과 같다.

```cpp
Accessor acc1 = &Stat::Access<MST_MAX, &Stat::movingSpeed, MST_WALK>;
Accessor acc2 = &Stat::Access<MST_MAX, &Stat::movingSpeed, MST_RUN>;
```

이제 일반적인 **Access**라는 멤버 함수를 사용하여 모든 멤버를 접근할 수 있게 되었다. 하지만 이미 선언할 때 명시해준 배열의 크기를 또 적어주어야 하는 것은 마음에 들지 않는다. 이를 고쳐보자.


배열의 크기를 구하기 위해 간단한 메타 템플릿 함수를 작성해보자. 일단 일반적인 interface를 선언하고,

```cpp
template <typename T>
struct countof;
```

그리고 배열의 크기를 알아내기 위한 특수화된 *specialization* 메타 템플릿 함수를 작성한다.

```cpp
template <typename _Ty, typename _Class, size_t _Size>
struct countof<_Ty (_Class::*)[_Size]> {
    enum { value = _Size };
};
```

`countof`의 타입 argument가 `_Ty (_Class::*)[_Size]` 형태이면 그 `_Size`를 value로 갖는 메타 템플릿 함수이다. `decltype` 키워드를 사용하여 멤버 데이터 포인터의 타입을 얻을 수 있으므로, 다음과 같이 멤버 데이터 포인터가 가리키는 배열의 크기를 얻을 수 있다.

```cpp
countof<decltype(&Stat::movingSpeed)>::value
```

이제 위 배열 멤버에 대한 접근을 다음과 같이 표현할 수 있게 되었다.

```cpp
Accessor acc1 = &Stat::Access<countof<decltype(&Stat::movingSpeed)>::value,
    &Stat::movingSpeed, MST_WALK>;
```

모든 준비가 갖추어졌다. 멤버의 데이터 타입이 배열이든, 그렇지 않든 `float& (Stat::*)()` signature를 사용하여 값을 얻을 수 있게 되었다.

이제 이전 글에서 했던 방법처럼 코드를 정리하면 된다.

```cpp
typedef float& (Stat::*StatAccessor)();
StatAccessor statAccessorTable[BUFF_MAX];
 
statAccessorTable[BUFF_HP] = &Stat::Access<&Stat::hp>;
statAccessorTable[BUFF_WALK_SPEED] = &Stat::Access<countof<decltype(&Stat::movingSpeed)>::value,
    &Stat::movingSpeed, MST_WALK>;
```

`statAccessorTable`을 사용하여 switch-case 구문도 깔끔하게 정리할 수 있다.

```cpp
StatAccessor accessor = statAccessorTable[buffType];
switch (buffMethod) {
case SET: (stat.*accessor)() = buffValue; break;
case ADD: (stat.*accessor)() += buffValue; break;
case RATE: (stat.*accessor)() *= buffValue; break;
```

`AccessorTable`을 등록할 때, 아무래도 배열 타입을 등록하는데 코드가 쓸데없이 길어진다. 이는 매크로를 사용하여 깔끔하게 정리할 수 있겠다.

```cpp
// buff_type.inl
BUFF_ENUM(BUFF_HP, &Stat::hp)
BUFF_ENUM_A(BUFF_WALK_SPEED, &Stat::movingSpeed, MST_WALK)
```

역시 적절한 macro 함수 교체를 통해 적절한 코드가 생성되도록 한다.

```cpp
// buff_bind.cpp
#define BUFF_ENUM(name, ptr) statAccessorTable[name] = &Stat::Access<ptr>;
#define BUFF_ENUM_A(name, ptr, idx) \
    statAccessorTable[name] = &Stat::Access<countof<decltype(ptr)>::value, ptr, idx>;
#include "buff_type.inl"
#undef BUFF_ENUM_A
#undef BUFF_ENUM
```


본 글에서는 완전히 일치하지는 않지만 어느 정도 타입이 비슷할 때, 멤버 데이터 포인터가 아닌 **template 인자를 활용한 멤버 함수로 signature를 맞추어 반복되는 코드의 양을 줄이는 방법**에 대해 알아보았다.

지난 번 글에서도 언급했지만, 이것이 가능했던 이유는 각 멤버들이 모두 float이었기 때문이다. 다음 글에서는 type erasure를 사용하여 좀 더 일반적인 (하지만 성능에서는 손해를 보는) 방법에 대해 알아보도록 하겠다.
