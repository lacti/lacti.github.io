---
layout: post
title: c++에서 reflection 사용하기 2
tags: c++ reflection -pub
---

지난 번 글의 문제점은 다음과 같다.

* class 정보가 없다. 따라서 이름으로부터 class에 대한 객체를 생성할 수가 없다.
* field에 대한 정보가 구체 class에 묶여있다. 따라서 그 class를 모르면 field 정보를 얻어올 수 없다.

그래서 이번에는 다음의 기능을 중점으로 구현하였다.

* 이름(문자열)로 class 정보 찾기
* class 정보는 class 객체를 생성할 수 있어야 함
* class 정보는 field 정보를 이름(문자열)로 찾을 수 있어야 함
* field 정보는 객체의 주소로부터 field 값을 가져오거나 설정할 수 있어야 함

마지막 항목은 지난 글에서 구현했던 내용이니, 앞의 세 항목을 어떻게 구현했는지 보도록 하자.  
(본 글에서는 글 읽는 흐름과 상관없는 별로 안 중요한 코드는 생략한다.)


먼저 class 정보에 대응되는 class를 만들어보자. 요구사항에서 언급했듯이, 얘는 자신의 type정보로 객체를 생성 가능해야하며, 이름으로 특정 field를 찾을 수 있어야 한다.

```cpp
class class_t {
public:
    class_t(std::string _name);
    const field_t* get_field(std::string name) const;
    void add_field(std::string name, field_t* field);

    template <typename _Class>
    _Class* new_instance() const {
        return reinterpret_cast<_Class*>(new_instance_impl());
    }

private:
    virtual void* new_instance_impl() const = 0;

private:
    typedef std::map<std::string, field_t*> field_map_t;
    field_map_t field_map;
};
```

`field_t*`에 대한 map을 가지고 `add_field()`/`get_field()` 할 수 있는 간단한 class이다. `add_field()`와 `get_field()` 함수 모두 public으로 공개되어 있으니 class 정보를 접근할 때 실행 도중에 field를 `add_field()` 할 수 있는 위험이 있지 않을까? 하는 생각이 들 수도 있는데, 일단 `class_t` 객체를 사용할 때는 무조건 `const class_t*`를 사용하게 하면 `add_field()` 함수는 const가 아니니까 적당히 괜찮지 않을까 싶다.

재밌는 부분은 객체를 생성하는 부분이다. 이 역시 class_t 자체에는 type 정보가 없으므로(`field_t`와 동일한 이유) 구체 class에게 생성을 맡긴다. 하지만 구체 class가 뭘 생성할지 모르므로 `void*`로 일단 받고 casting해서 반환하는 대범함을 보인다. (`field_t` 때와 마찬가지로 `new_instance()` 함수에 type 인자를 잘못 주면 안드로메다를 보게 된다.)

구체 class는 `field_impl_t`보다 훨씬 간단하다.

```cpp
template <typename _ObjTy>
class class_impl_t : public class_t {
public:
    class_impl_t(std::string name);

private:
    virtual void* new_instance_impl() const {
        return new _ObjTy;
    }
};
```

구체 class는 어차피 자기가 어떤 class에 대한 것인지 type 정보를 template으로 받고 있으므로 그에 대해 new 해서 돌려주면 그만이다. 물론 기본 생성자가 없다면 컴파일 에러가 난다.

이는 [java annotation과 reflection을 사용한 xml mapping]({% post_url 2012-05-31-xml-mapping-using-java-annotation-and-reflection %})에서 `Class#newInstance()`와 기본생성자에 관해 이야기했던 것과 동일한 이유라고 보면 된다.  
기본 생성자가 아닌 생성자에 대해서도 고려해주려면 method에 대한 reflection도 만들어주어야 하는데 variadic template을 지원하지 않는 MSVC10에서는 별로 구현하고 싶지 않다-_-;


이제 class의 이름과 `class_t`를 관리해줄 관리자 class를 만들어야 한다. class의 이름은 `std::type_info.name()`을 쓰면 좋겠지만 이 이름이 그닥 적절하지 못하다.

예를 들어 `struct user_t {}`라는 구조체가 있다면 `typeid(user_t).name()`은 MSVC 기준으로 `"struct user_t"`가 된다. 이 경우 이름을 통해 `class_t`를 찾아올 때 영 좋지 못할 수가 있으니 직접 이름을 등록할 수 있도록 할 것이다.

이 때 문제가 될 수 있는 것은, 어떤 객체에 대한 `class_t`를 가져올 때, 그 객체의 class의 이름을 뭐라고 등록했는지 찾아야 한다는 것이다. 때문에 관리자 class는 사용자 지정 이름과 `class_t`만을 관리하는 것이 아니라, 그 객체의 `std::type_info*`와 사용자 지정 이름도 관리해야 각 객체들은 자신의 `class_t`를 적절히 찾아올 수 있게 될 것이다.

```cpp
class reflection_base {
public:
    static reflection_base& instance();
    const class_t* get_class(std::string name) const;
    const field_t* get_field(std::string class_name, std::string field_name) const;

public:
    void add_class(std::string name, class_t* class_impl);
    void add_field(std::string class_name, std::string field_name, field_t* field_impl);

    void add_class_name(const std::type_info* typeinfo, std::string class_name);
    const char* class_name_from_typeinfo(const std::type_info* typeinfo) const;

private:
    reflection_base() {}
    reflection_base(const reflection_base&);
    reflection_base& operator= (const reflection_base&);

private:
    typedef std::map<const std::type_info*, std::string> class_name_map_t;
    typedef std::map<std::string, class_t*> class_map_t;

    class_name_map_t class_name_map;
    class_map_t class_map;
};
```

singleton pattern의 `reflection_base` class는 `type_info`와 사용자 지정 이름, 사용자 지정 이름과 `class_t`에 대한 map을 갖는다. 그리고 이를 등록하고 찾아서 반환할 수 있도록 한다. (어차피 내부 구현 코드는 map에 대한 insert, find이니 자세한 코드는 생략한다.)

이제 `class_t`를 관리하고 찾을 수 있는 방법이 생겼으니, 특정 객체에 대해 다른 class들이 `class_t`를 얻을 수 있도록 helper격의 class를 하나 만들어보자.

```cpp
class reflection_class_t {
public:
    virtual ~reflection_class_t() {}

    const char* type_name() const {
        return typeid(*this).name();
    }
    const char* class_name() const {
        return reflection_base::instance()
            .class_name_from_typeinfo(&typeid(*this));
    }
    const class_t* get_class() const{
        return class_t::from_name(class_name());
    }
};
```

이제 `reflection_class_t`를 상속받는 class들은 `get_class()` 함수를 통해 자신의 `class_t*`를 가져올 수 있게 된다.


마지막으로 `reflection_base`에 `class_t`와 `field_t`를 등록하는 함수를 만들어보자. 이는 지난 번 글에서 사용했던 매크로와 유사한 코드이다.

```cpp
template <typename _ObjTy>
inline void register_class(std::string class_name) {
    reflection_base::instance().add_class_name(&typeid(_ObjTy), class_name);
    reflection_base::instance().add_class(class_name, 
        new class_impl_t<_ObjTy>(class_name));
}

template <typename _ObjTy, typename _FieldTy, typename _FieldTy (_ObjTy::*Field)>
inline void register_field(std::string field_name) {
    const char* class_name = reflection_base::instance()
        .class_name_from_typeinfo(&typeid(_ObjTy));
    assert(class_name);

    reflection_base::instance().add_field(class_name, field_name, 
        new field_impl_t<_ObjTy, _FieldTy, Field>(field_name));
}
```

`register_class()` 함수는 특정 class type에 대해 지정한 이름으로 `class_impl_t` 객체를 만들어서 등록한다. 이 때 해당 class의 type과 사용자 지정 이름을 `class_name_map`에 같이 등록해준다.

`register_field()` 함수는 특정 class를 찾아서, 그 `class_t`가 관리하는 `field_map`에 `field_impl_t` 객체를 만들어서 등록한다.


이제 위에서 작성한 코드는 다음과 같이 사용될 수 있다.

```cpp
using namespace reflection;

class base_t : public reflection_class_t {
public:
    virtual ~base_t() {}
};

struct user_t : public base_t {
    int index;
    std::string name;
};

int _tmain(int argc, _TCHAR* argv[])
{
    register_class<user_t>("user_t");
    register_field<user_t, int, &user_t::index>("index");
    register_field<user_t, std::string, &user_t::name>("name");

    const class_t* clazz = class_t::from_name("user_t");
    std::cout << clazz->name() << std::endl;
    clazz->enumerate_fields([&] (const field_t* field) {
        std::cout << "\t" << field->name() << std::endl;
    });

    base_t* ptr = clazz->new_instance<base_t>();
    assert(clazz == ptr->get_class());
    delete ptr;

    return 0;
}
```

`user_t`에 대해 reflection을 등록한다.  
(이 부분은 딱히 답이 없는데, 편하게 하려면 code generator를 사용한다던가 하는 수 밖에 없어보인다.
아니면 [if1live]님이 했던 것처럼 매크로로 구조체를 만들도록 하든가.)

`class_t::from_name()` 함수를 사용해 이름으로 `class_t` 객체를 가져왔다. 그리고 `enumerate_fields()` 함수(본 문에서는 생략됨)를 사용하여 `class_t`가 가지고 있는 모든 field에 대한 이름을 출력해볼 수 있다.

그리고 `new_instance()` 함수로 객체를 생성할 수 있는데, 이 때 type을 부모의 type(`base_t`)으로 명시해준다. 하지만 실제 `class_t`는 `user_t`에 대한 `class_t`이므로, 이 때 생성되는 객체는 `user_t`에 대한 객체이다. 그렇기 때문에 `clazz` 변수와 `ptr->get_class()` 변수가 모두 `user_t`에 대한 `class_t`로 일치하는 것이다.


그냥 map 등록/참조이기 때문에 새로울 것이 없는 내용이다. 성능 문제야 당연히 있겠지만 map을 hash_map으로 바꾸는 것 이외에는 그닥 좋은 방법이 떠오르지 않는다. 오히려 register를 좀 자동으로 해줄 수 있는 방법이 없을까 하는 것이 더 고민이다.
