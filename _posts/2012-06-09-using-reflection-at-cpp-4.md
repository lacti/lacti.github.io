---
layout: post
title: c++에서 reflection 사용하기 4
tags: c++ reflection
---

이전 글에서는 자료구조가 선언된 header파일을 여러 번 include하면 문제가 발생했었다. 하지만 이리저리 참조가 되다보면 각 번역 단위에서 include가 한 번만 되는 것은 굉장히 힘든 일일 것이다.

따라서 본 글에서는 매크로를 잘 정의해서 선언 header파일이 구조체 선언, reflection 등록 딱 2번만 include가 될 수 있도록 만들어볼 것이다. [이전 글(#3)의 소스 코드](https://github.com/lacti/FieldInfo/tree/v0.3) 내의,

* [reset_type_macro.h](https://github.com/lacti/FieldInfo/blob/v0.3/reset_type_macro.h)
* [type_declare_macro.h](https://github.com/lacti/FieldInfo/blob/v0.3/type_declare_macro.h)
* [type_register_macro.h](https://github.com/lacti/FieldInfo/blob/v0.3/type_register_macro.h)
* [user.h](https://github.com/lacti/FieldInfo/blob/v0.3/user.h)

가 이번 글의 타겟이 될 것이다.


`#include`를 하는 phase는 2단계로 나뉜다.

* 첫 번째는 구조체를 선언하기 위한 단계로 `DECLARE_PHASE`라고 하겠다. 이 때 `STRUCT` 매크로들은 `DECLARE` 매크로가 사용되어야 하므로, 이 시점에서는 type_declare_macro.h가 include된 상태이어야 한다.
* 두 번째는 선언된 구조체의 reflection 정보를 등록하는 단계로 `REGISTER_PHASE`라고 하겠다. 이 때 STRUCT 매크로들은 REFLECTION_REGISTER 매크로가 사용되어야 하므로, 이 시점에서는 type_register_macro.h가 include된 상태이어야 한다.

두 macro.h 파일이 처음 참조하게 되는 초기화 파일인 reset_type_macro.h 파일에서 각 상태를 먼저 초기화해줄 수 있도록 한다.

```cpp
#ifdef STRUCT_BEGIN
#undef STRUCT_BEGIN
#endif

#ifdef STRUCT_END
#undef STRUCT_END
#endif

#ifdef STRUCT_FIELD
#undef STRUCT_FIELD
#endif

#ifdef __DECLARE_PHASE__
#undef __DECLARE_PHASE__
#endif

#ifdef __REGISTER_PHASE__
#undef __REGISTER_PHASE__
#endif
```

이제 어떤 macro.h가 include되냐에 따라서 `STRUCT`와 `PHASE`도 변경될 수 있도록 밑작업을 마쳤다.


구조체를 선언하기 위한 매크로가 정의된 type_declare_macro.h 파일을 보면 다음과 같다.

```cpp
#include "reset_type_macro.h"

#ifndef __DECLARE_TYPE_MACRO_DEFINED__
#define __DECLARE_TYPE_MACRO_DEFINED__
#define DECLARE_BEGIN(class_name) \
    struct class_name; \
    typedef std::shared_ptr<class_name> class_name##_ref; \
    struct class_name : public object_t {

#define DECLARE_FIELD(type, field_name) \
        type field_name;

#define DECLARE_END()   \
    };
#endif

#define STRUCT_BEGIN(class_name)        DECLARE_BEGIN(class_name)
#define STRUCT_FIELD(type, field_name)  DECLARE_FIELD(type, field_name)
#define STRUCT_END()                    DECLARE_END()

#define __DECLARE_PHASE__
```

`DECLARE` 계열 매크로의 중복 정의를 막고, `STRUCT`가 `DECLARE` 매크로를 가리키게 한 다음,
현재 상태를 `DECLARE_PHASE`로 만든다.

선언된 구조체의 reflection 정보를 등록하기 위한 매크로가 정의된 type_register_macro.h 파일을 보면 다음과 같다.

```cpp
#include "reflection_macro.h"
#include "reset_type_macro.h"

#define STRUCT_BEGIN(class_name)        REFLECTION_REGISTER_BEGIN(class_name)
#define STRUCT_FIELD(type, field_name)  REFLECTION_REGISTER_FIELD(type, field_name)
#define STRUCT_END()                    REFLECTION_REGISTER_END()

#define __REGISTER_PHASE__
```

`STRUCT`가 `REFLECTION_REGISTER` 매크로를 가리키게 한 다음, 현재 상태를 `REGISTER_PHASE`로 만든다.


이제 모든 준비가 완료되었으니, user.h 파일에서 각 상태 별로 한 번씩만 include가 되도록 만들어주자.

```cpp
#if (defined(__DECLARE_PHASE__) && !defined(__USER_DECLARED__)) \
    || (defined(__REGISTER_PHASE__) && !defined(__USER_REGISTERED__))

#if defined(__DECLARE_PHASE__) && !defined(__USER_DECLARED__)
#define __USER_DECLARED__
#endif

#if defined(__REGISTER_PHASE__) && !defined(__USER_REGISTERED__)
#define __USER_REGISTERED__
#endif

STRUCT_BEGIN(user_t)
    STRUCT_FIELD(int, index)
    STRUCT_FIELD(std::string, name)
STRUCT_END()

#endif
```

기존에는 #ifndef, #define ~ #endif 와 같이 단순히 중복 include를 막아줄 수 있었지만, 이제는 `DECLARE_PHASE`, `REGISTER_PHASE` 각각 한 번씩 include를 허용해주어야 하므로 상태를 따로 관리해야 한다.

따라서 `USER DECLARED`, `REGISTERED` 상태 2개를 갖고,

* `DECLARE_PHASE`에서는 DECLARED 상태가 아닐 때만 진입 가능하도록,
* `REGISTER_PHASE`에서는 REGISTERED 상태가 아닐 때만 진입 가능하도록 매크로를 작성한다.

이제 처음 #if 조건문에 의해, 각 상태마다 단 한 번의 include만 허용하게 된다.

한가지 안타까운 점은, 실제 구조체를 선언하는 모든 header 파일에 위와 같은 안전자 지시 장치를 해주어야 한다는 것이다. 이는 생각보다 번거로운 작업이 될 수 있는데, file template을 잘 만들어서 쓰거나 하면 어느정도 해결할 수 있을 것 같다.


여기까지 구조체를 선언, reflection 정보를 등록했고, 다음에는 등록한 reflection 정보를 사용하여 xml과 어떻게 bind할 것인지에 대해 살펴보자. 추가로 각 구조체의 version을 관리하여 어떻게 convert를 작성할 수 있을지도 고민해보도록 하자.