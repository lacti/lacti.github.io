---
layout: post
title: member-data-pointer와 pointer의 차이
tags: c++ -pub
---

pointer는 메모리의 특정 공간의 주소를 지칭하기 위해 사용된다.

```cpp
float some_var = 1.0f;
float* float_ptr = &some_var;
```

member data pointer는 구조체나 클래스의 특정 멤버 변수의 위치를 상대적으로 지칭하기 위해 쓰인다. 따라서 메모리 주소 값을 가지는 것이 아니라, 구조체나 클래스 객체에서 어디에 접근을 해야하는지의 정보를 담고 있다고 생각하면 된다.

```cpp
struct tuple_t {
    float first;
};
typedef float tuple_t::*member_t;
```

때문에 실제 메모리에 접근하기 위해서는 구조체나 클래스 객체가 있어야 하고, 접근할 때에도 dereference operator를 써주어야 한다.

```cpp
member_t member = &tuple_t::first;
tuple_t tuple;
tuple.*member = 100.0f;
```

위와 같이 `tuple.*member`를 통해 `member`가 가리키는 `first` 변수에 접근할 수 있었다. 이것은 `tuple` 객체 내에서 `member`가 가리키는 위치이고, `tuple`이라는 메모리 공간의 특정 지점에 접근을 하였으니 이제 float 값을 대입할 수 있는 것이다.

이제 float*로 저것을 가리킬 수 있다.

```cpp
float* float_ptr = &(tuple.*member);
```

요약하면,

* 메모리 주소 값을 갖는 `float*`와는 다르게 member-data-pointer는 객체 내의 상대적 위치 정보를 갖기 때문에 바로 `float*`로 casting할 수는 없고,
* 객체를 두고 객체 내의 멤버를 접근한 다음(`.*` 혹은 `->*`)에야 메모리 주소인 `float*`로 가리킬 수 있게 된다는 것이다.

member-data-pointer가 member의 위치를 어떻게 가리킬 수 있는지에 대한 세부 내용은 접어두더라도, 객체 내의 member 위치(`offset_of`)의 방법을 이해하면 굳이 member-data-pointer를 쓰지 않아도 비슷한 효과를 흉내낼 수 있다(c-style)

이에 대해서는 다음 글에서 알아보자.