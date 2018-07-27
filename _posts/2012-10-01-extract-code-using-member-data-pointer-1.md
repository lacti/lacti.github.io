---
layout: post
title: 멤버 데이터 포인터를 사용하여 연산식 묶어내기 1
tags: c++ refactor
---

게임 내 스탯 시스템을 구현한다고 해보자. 그 스탯들은 여러 상황에서 버프에 의해 값이 변경될 수 있기 때문에

* **스탯을 저장하는 자료구조**와
* 그 **스탯을 변경하기 위한 버프 종류 enum**과,
* 각 버프 종류 enum에 따라 스탯을 어떻게 변경할지에 대한 **연산식**에 대해서

코딩을 해주어야 한다.

```cpp
enum BuffType {
    BUFF_HP,
    BUFF_MP,
    BUFF_ATTACK,
    BUFF_DEFENCE,
};
struct Stat {
    float hp;
    float mp;
    float attack;
    float defence;
};
```

일단 각 스탯에 어떤 값을 어떻게 계산하면 되는지에 대해서는 다음의 3가지로 추상화를 했다고 치자. **SET, ADD, RATE** 즉, 지정, 더하기, 곱하기이다.

그럼 대충 다음과 같은 코드가 나온다.

```cpp
switch (buffType) {
case BUFF_HP:
    switch (buffMethod) {
    case SET: stat.hp = buffValue; break;
    case ADD: stat.hp += buffValue; break;
    case RATE: stat.hp *= buffValue; break;
    }
    break;
```

`BUFF_MP`, `BUFF_ATTACK`, `BUFF_DEFENCE` 등 버프 종류가 바뀌어도 연산하는 식은 똑같다. 다만 stat 구조체 내의 어떤 변수를 접근하는지만 바뀌는 것이다.

버프의 종류가 한 100가지 된다고 치자. 그러면 100개의 동일한 case pattern을 다 코딩해주어야 하나? 그리고 SET, ADD, RATE 말고 **EXPONENT**라는 방법이 추가되었다고 해보자. **맙소사!**


위 상황을 해결할 수 있는 가장 간단한 방법은 `BuffType` enum에 대응되는 `Stat` 자료구조의 멤버 데이터 포인터를 묶어주는 것이다.

```cpp
typedef float Stat::*StatDataPtr;
StatDataPtr statDataPtr[BUFF_MAX];

statDataPtr[BUFF_HP] = &Stat::hp;
statDataPtr[BUFF_MP] = &Stat::mp;
```

각 Buff의 종류별로 어떤 멤버를 접근할지 정보를 구성했으니, 아까의 코드가 한결 간편해진다.

```cpp
StatDataPtr dataPtr = statDataPtr[buffType];
switch (buffMethod) {
case SET: stat.*dataPtr = buffValue; break;
case ADD: stat.*dataPtr += buffValue; break;
case RATE: stat.*dataPtr *= buffValue; break;
```

이제 `BuffType`이 추가될 때마다 해당 `BuffType`에 대응되는 `Stat`의 데이터 포인터를 배열에 추가해주기만 하면 된다. 그리고 Method가 추가되어도, 그러한 연산을 수행하는 코드가 한 곳에만 존재하기 때문에 Method를 확장하기도 좋다.


하지만 아무래도 enum을 정의하고 나서 데이터 포인터와의 연결을 위해 다시 한 번 enum을 언급하는 것은 귀찮다. 이를 해결하기 위해서 X-Macro pattern를 써보자.

```cpp
// buff_type.inl
BUFF_ENUM(BUFF_HP, &Stat::hp);
BUFF_ENUM(BUFF_MP, &Stat::mp);
```

위와 같이 `BUFF_ENUM`이라는 매크로를 사용하여 enum 정의와 데이터 포인터 연결을 같이 할 수 있도록 묶어주고,

```cpp
// buff_type.h
#define BUFF_ENUM(name, ptr) name,
enum BuffType {
#include "buff_type.inl"
};
#undef BUFF_ENUM
```

header 파일과 cpp 파일에 각기 다른 macro 함수를 적용하여 적절한 코드를 생성하도록 한다.

```cpp
// buff_bind.cpp
#define BUFF_ENUM(name, ptr) statDataPtr[buff] = ptr;
#include "buff_type.inl"
#undef BUFF_ENUM
```

이제 새로운 버프가 추가되면, buff_type.inl 파일 하나에만 `BUFF_ENUM`으로 추가해두면, buff_type.h와 buff_bind.cpp 양 쪽에 코드가 적절히 치환되어 적절하게 추가될 것이다.


물론 코드가 모두 이렇게 깔끔하게 묶어낼 수 있는 것은 아니지만 만약 대부분의 코드를 이렇게 묶어낼 수 있다면, 이는 충분히 시도할만한 가치가 있는 방법이라고 생각된다.

편의상 `Stat` 구조체의 모든 변수가 float임을 가정했는데, 만약 그렇지 않다면 type erasure를 써야 하는데 이건 본 글에서 다루는 내용보다 더 큰 내용이니 다음에 다루도록 하겠다.

다음 글에서는 어제 [summerlight]님께 배운 정보를 바탕으로 `Stat` 구조체 내부에 배열이 있을 경우에 어떻게 처리할 수 있을지에 대해서 알아보겠다.