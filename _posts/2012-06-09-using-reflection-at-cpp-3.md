---
layout: post
title: c++에서 reflection 사용하기 3
tags: c++ reflection -pub
---

지난 #2에서는 `class_t`, `field_t` 자체가 가상 함수를 갖고, `class_impl_t`와 `field_impl_t`가 이 class를 상속 받아서 구현하는 방식을 사용하였다. 사실 굳이 이 `impl_t` class 들은 노출될 필요가 없으므로 이를 감추도록 해보자.

그리고 다 완성된 type을 register함에 있어, 따로 `register_class`, `register_field` 함수를 직접 불러서 등록을 하였는데, 이것을 [X-Macro pattern](http://en.wikipedia.org/wiki/X_Macro)을 사용하여 개선해보도록 하자.


**C++ Template Metaprogramming**의 형식 삭제(type erasure) 부분을 읽다보니, 굳이 `impl_t` class를 `class_t`, `field_t` 외부로 노출할 필요가 없다는 것을 깨달았다.  
(물론 위 책에서 언급하는 예제는 복사 및 대입 가능한 대상이기 때문에 복사/대입/소멸 등도 고려되어 있지만, 본 글에서는 단지 `impl_t`를 숨기기 위한 용도 정도로만 사용한다.)

type erasure에 대한 개념을 간단히 적어보면 reflection을 만든다는 것은 결국 runtime까지 type 정보를 유지한다는 것이다. type 정보를 코드 하나하나에 다 열거하는 것은 쓸데없는 노동력을 요구하므로 적절히 template을 써서 type 정보를 capture한다.

문제는 이렇게 type capture를 한 template class는 일반 type으로 지칭할 수 없다는 귀찮은 점이 있다. 예를 들어서,

```cpp
template <class _Ty>
class class_t {};
```

위와 같은 `class_t`에 대해, `class_t<int>`와 같은 type 정보를 넣어 template class를 구체화했다면, 이 class는 `class_t`가 아니고 `class_t<int>`이다. 좀 더 엄밀히 말하면 구체화되지 않은 `class_t`라는 class는 없는 것이다.

때문에 지난 번에는 `class_t`와 그것을 상속받는 `class_impl_t`를 만들고, type 정보를 `class_impl_t`에만 국한시켜 실제 사용하는 `class_t`에서는 따로 type 정보 없이 사용할 수 있는 것이다.

하지만 외부 register 함수에서 `class_impl_t`, `field_impl_t` 객체를 직접 생성해서 `class_t`, `field_t`에 넣어주는 영 좋지 못한 구조를 보였다. 이를 함수 template을 사용하여 보다 나은 방법으로 개선해보자.

변경된 `class_t`는 다음과 같다. (`class_impl_t`는 삭제되었다, 그리고 지난 번과 중복되는 내용은 삭제한다.)

```cpp
class class_t {
public:
    template <typename _Ty>
    class_t(const typeinfo<_Ty>&, std::string name)
        : inf(new impl_t<_Ty>), class_name(name) {}

    template <typename _Class>
    _Class* new_instance() const {
        return reinterpret_cast<_Class*>(inf->new_instance());
    }
private:
    struct interface_t {
        virtual void* new_instance() const = 0;
    };
    template <typename _Ty>
    struct impl_t : public interface_t {
        virtual void* new_instance() const { return new _Ty; }
    };
private:
    std::shared_ptr<interface_t> inf;
};
```

지난 번과 동일한 부분을 과감히 생략하고 변경된 부분만 모아보면 위와 같다.

* `class_t` 내부에 `interface_t`와 `impl_t`가 들어갔다.
* `impl_t`는 template을 사용하여 실 type 정보를 capture할 class이고,
* `interface_t`는 `impl_t`를 일반적으로 접근하기 위한 interface class이다.

`class_t`의 생성자가 type 정보를 직접 받기 위해 template 함수로 작성되었다. 재밌는 점은 함수 template 생성자에 type 정보를 넘기기 위해 `<>`으로 명시해주는 것은 쓸 수가 없어 이를 적당히 회피하기 위해 type 정보를 컴파일러에게 알려주기 위해 class 하나를 추가한다는 것이다.

```cpp
template <typename _Ty>
class typeinfo {};
```

그래서 `class_t` 생성자는 `typeinfo<_Ty>` 객체를 인자로 받는 것이고, 이 인자를 통해 어떤 `_Ty`을 넘기려 하는 것인지 type 추론이 가능해진다. 그러면 해당 type으로 생성자가 구체화가 되고, 그 생성자에서는 `_Ty` 정보를 사용하여 `impl_t` 객체를 만들고, 이 객체를 `interface_t` 변수에 넣어두는 것이다. 그러면 기존 `class_t`의 virtual 함수를 non-virtual 함수로 만들고 수행에 대해서는 내부 `interface_t` 객체를 통해 적절히 delegate해주면 된다.


`field_t` 역시 위와 동일한 방법으로 개선하였다.

```cpp
class field_t {
public:
    template <typename _ObjTy, typename _FieldTy>
    field_t(_FieldTy (_ObjTy::*Field), std::string name)
        : inf(new impl_t<_ObjTy, _FieldTy>(field)), field_name(name) {}
private:
    struct interface_t {
        virtual void* ptr(void* obj_addr) const = 0;
        virtual const std::type_info& type() const = 0;
    };
    template <typename _ObjTy, typename _FieldTy>
    struct impl_t : public interface_t {
        impl_t(_FieldTy (_ObjTy::*Field)) : field(Field) {}
        virtual const std::type_info& type() const { return typeid(_FieldTy); }
        virtual void* ptr(void* obj_addr) const;

        _FieldTy (_ObjTy::*field);
    };
private:
    std::shared_ptr<interface_t> inf;
};
```

생성자를 template 함수로 만드는 방법은 `class_t`와 똑같은데, 아까 만든 `typeinfo`를 사용하여 type 정보를 넘기지는 않는다.  
기존의 `field_impl_t`에서 실제 field까지 template 인자로 받았던 것에 반해, 새로운 구조에서는 data member pointer를 생성 인자로 받기 때문에 `_FieldTy (_ObjTy::*Field)`이 인자를 통해서 충분한 type 유추가 가능하기 때문이다. (따라서 `impl_t`도 data member pointer를 인자로 갖도록 수정되었다.)

그 이외에 `impl_t` 객체를 만들어서 `interface_t`로 지칭하는 것이나, `field_t`의 작업 함수들이 수행을 `interface_t` 객체로 위임하는 것은 위 `class_t`에서 언급했던 내용과 동일하다.


이제 reflection 정보를 register하는 코드를 개선할 것이다. 기존에는 외부로 노출된 template 함수를 통해 직접 type 및 이름 정보를 입력하여 하나씩 정보를 등록하였다.

하지만 각 field를 정의할 때마다 어떤 class에 대한 field인지 매번 써주는 것은 비효율적이므로, 이를 개선하기 위해 다음과 같이 register를 도와주면서 어떤 class에 대한 register인지 type 정보를 갖고 있는 class를 설계해보자.

```cpp
template <typename _ObjTy>
struct reflection_register_helper_t {
    typedef _ObjTy target_type;

    static void register_class(std::string class_name);
    template <typename _FieldTy>
    static void register_field(_FieldTy (_ObjTy::*Field), std::string field_name);
};

template <typename _ObjTy>
inline void reflection_register_helper_t<_ObjTy>::register_class(std::string class_name)
{
    reflection_base::instance().add_class_name(&typeid(_ObjTy), class_name);
    reflection_base::instance().add_class(class_name, 
        new class_t(typeinfo<_ObjTy>(), class_name));
}

template <typename _ObjTy>
template <typename _FieldTy>
inline void reflection_register_helper_t<_ObjTy>::register_field(
    _FieldTy (_ObjTy::*Field), std::string field_name)
{
    const char* class_name = reflection_base::instance()
	    .class_name_from_typeinfo(&typeid(_ObjTy));
    assert(class_name);

    reflection_base::instance().add_field(class_name, field_name,
        new field_t(Field, field_name));
}
```

`reflection_register_helper_t` class는 template으로 type 정보를 받고 이를 유지한다. 따라서 `register_class()` 함수나 `register_field()` 함수는 따로 어떤 class에 대한 정보인지 type 정보를 받을 필요가 없다.

이제 매크로를 통해 다음과 같이 대신 등록해주는 코드를 만들어볼 수 있다.

```cpp
#define REFLECTION_REGISTER_BEGIN(class_name)  \
    static struct _register_##class_name :
            public reflection::reflection_register_helper_t<class_name> { \
       _register_##class_name() \
        { \
            register_class(#class_name);

#define REFLECTION_REGISTER_FIELD(type, field_name) \
            register_field<type>(&target_type::field_name, #field_name);

#define REFLECTION_REGISTER_END()  \
        } \
    } __AUTO_NAME;
```

(`__AUTO_NAME`은 `__COUNTER__`를 사용하여 겹치지 않는 아무 이름이나 만들어주는 매크로이다. [lambda 와 RAII #2]({% post_url 2012-05-12-lambda-and-raii-2 %}))

`REFLECTION_REGISTER_BEGIN`, `FIELD`, `END` 매크로를 사용하면 등록하고자 하는 class의 정보를 template argument로 갖는 reflection_register_helper_t에 대한 상속 class를 만든다. 그리고 생성자에서 class, field 정보를 등록하는 코드를 차례대로 만들어둔 뒤, `END` 매크로에서 이 `register_class`에 대한 변수를 하나 만들게 된다.

만약 이 변수가 전역 변수로 선언된다면 프로그램이 실행될 때 해당 객체가 초기화되면서 생성자의 코드가 실행될 것이고, 그 때 해당 type에 대한 reflection 정보가 등록될 것이다.

```cpp
REFLECTION_REGISTER_BEGIN(user_t)
	REFLECTION_REGISTER_FIELD(int, index)
	REFLECTION_REGISTER_FIELD(std::string, name)
REFLECTION_REGISTER_END()
```

(`reflection_register_helper_t` class가 `user_t`에 대한 type 정보를 `target_type`이라고 지칭할 수 있게 해주어서, `FIELD`를 등록할 때 다시 `user_t`를 언급할 필요가 없어졌다!)


이제 [X-Macro pattern](http://en.wikipedia.org/wiki/X_Macro) 방법을 정의한 구조체에 대한 type 정보를 등록하는 것을 자동화해볼 것이다. 이 방법의 핵심은 구조체 선언을 매크로로 하고, 선언된 header 파일을 여러 번 incldue하고, 그 때마다 선언 매크로를 다른 것으로 치환(undef/define)하여 사용하는 것이다.

먼저 선언을 위한 매크로를 정의해보면 다음과 같다.

```cpp
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
```

(본 글에서는 생략했지만 `DECLARE`로 정의된 모든 class는 `object_t`를 상속받고, `object_t`는 `reflection_class_t`를 상속받기 때문에 reflection 정보를 가질 수 있다.)

`STRUCT_BEGIN`, `FIELD`, `END` 매크로는 선언(declare) 단계에서는 `DECLARE_BEGIN`, `FIELD`, `END`를 사용하도록 작성이 되어있다.

이제 다음과 같이 `user_t`를 정의하면 (user.h)

```cpp
STRUCT_BEGIN(user_t)
    STRUCT_FIELD(int, index)
    STRUCT_FIELD(std::string, name)
STRUCT_END()
```

위 매크로에 의해 다음과 같이 번역될 것이다. (`STRUCT` -> `DECLARE`)

```cpp
struct user_t {
    int index;
    std::string name;
};
```

이제, `STRUCT_BEGIN`, `FIELD`, `END`를 reflection을 등록하기 위한 매크로로 치환한다. (type_register_macro.h)

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

#define STRUCT_BEGIN(class_name)        REFLECTION_REGISTER_BEGIN(class_name)
#define STRUCT_FIELD(type, field_name)  REFLECTION_REGISTER_FIELD(type, field_name)
#define STRUCT_END()                    REFLECTION_REGISTER_END()
```

이제 다시 user.h 파일을 include하면, 이 때의 코드는 다음과 같이 번역될 것이다. (`STRUCT` -> `REFLECTION_REGISTER`)

```cpp
REFLECTION_REGISTER_BEGIN(user_t)
	REFLECTION_REGISTER_FIELD(int, index)
	REFLECTION_REGISTER_FIELD(std::string, name)
REFLECTION_REGISTER_END()
```

이에 대한 전체적인 코드 구조는 다음과 같다.

```cpp
#include "object.h"
#include "user.h"

#include "type_register_macro.h"
#include "user.h"

int main(int argc, char* argv[]) {
    const reflection::class_t* clazz = reflection::class_t::from_name("user_t");
```

`DECLARE` 매크로 정의를 포함한 object.h를 먼저 include하면, 그 뒤에 오는 user.h를 include하는 시점에는 구조체 선언이 이루어진다. 그리고 `REFLECTION_REGISTER` 매크로로 치환하는 type_register_macro.h를 include한 이후에 오는 user.h에서는 reflection 정보를 자동으로 등록하는 코드가 생성될 것이다.


본 글에서는 `class_impl_t`, `field_impl_t`를 숨기는 작업과, 매크로 치환과 #include를 여러 번 하는 방법을 사용하여 type 정보를 자동으로 등록하는 방법에 대해 알아보았다.

하지만 #include를 여러 번 하는 방법은, #pragma once나 #ifndef, #define ~ #endif을 통한 중복 include 방지를 사용할 수 없기 때문에 (혹은 사용한다고 하면 번거롭게 구조체 정의할 때마다 앞 뒤로 매크로 선언을 따로 해주어야 하기 때문에) include가 복잡하게 꼬이는 구조가 발생하면 여러 번 include 되어 문제가 발생할 수 있다.

매크로 상태를 사용하여 이를 해결할 수는 있는데 이에 대해서는 다음 글에 알아보도록 하자.