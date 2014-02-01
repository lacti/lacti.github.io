---
layout: post
title: c++에서 reflection 사용하기 1
tags: c++ reflection -pub
---

mmo-server에서 attribute를 json serialize하기 위해 attribute가 가지고 있는 field의 정보를 enumerate 해야할 일이 생겼다. 그런데 c++은 reflection이 없잖아?

그렇게 고민하다가 예전에 쓴 글을 발견했다.

* [c++에서 구조체 RTTI 정보 남기기]({% post_url 2011-09-30-using-rtti-at-cpp %})


기본 아이디어는 다음과 같다. 각 class마다 자신의 field에 대한 정보를 갖는다. 이름과 멤버 변수 포인터 쌍을 가진다고 보면 된다. 여기서 골치가 아픈건 저 field에 대한 정보를 어떻게 표기하냐인데, 멤버 변수 포인터라는 type을 좀 generic하게 관리해줄 방법이 필요하다. 제대로 하려면 코드가 복잡해질테니 대충 다음과 같이 틀만 잡았다.

```cpp
class field_t {
public:
    field_t(std::string _name) : field_name(_name) {}
    template <typename _FieldTy, typename _ObjTy>
    _FieldTy& ref(_ObjTy* obj) {
        _FieldTy* address = reinterpret_cast<_FieldTy*>(ptr(obj));
        return *address;
    }
    const char* name() const { return field_name.c_str(); }

protected:
    virtual void* ptr(void* obj) const = 0;

protected:
    std::string field_name;
};
```

핵심 함수가 `ref()`인 것 같지만 잘 보면 저건 훼이크 함수다. 인자로 받은 object를 `ptr()`이라는 의미심장한 virtual 함수에게 넘겨주고 자신은 그냥 그걸 적절한 field type으로 casting해서 반환해줄 뿐이다.

게다가 템플릿 함수! `field_t`라는 고정 type으로 모든 field에 대한 정보는 관리하고 싶지만, 그 field가 관리하는 멤버 변수 포인터가 반환하는 값은 모두 다르기에 별로 더 좋은 생각도 안 나고 ~~귀찮아서~~어쩔 수 없이 저렇게 작성했다.

때문에 `reinterpret_cast`가 등장했는데 함수에 대한 템플릿 인자를 클래스까지 확장하지 않고서는 객체의 type이나 field의 type 정보를 구체 구현 class까지 넘겨줄 방법이 없으므로 대충 `reinterpret_cast`로 때운 것이다. (덕분에 실 사용 type 검증 로직은 하나도 없고, 잘못 사용하면 안드로메다를 보게 된다.)

이제 저 `ptr()`을 구현하는 구체 클래스를 만들면 된다. 역시 대충 만들었다.

```cpp
template <typename _ObjTy, typename _FieldTy, typename _FieldTy (_ObjTy::*Field)>
class field_impl_t : public field_t {
public:
    field_impl_t(std::string _name) : field_t(_name) {}

protected:
    virtual void* ptr(void* obj_addr) const {
        _ObjTy* obj = reinterpret_cast<_ObjTy*>(obj_addr);
        return &(obj->*Field);
    }
};
```

예전 글에서는 offset을 직접 계산해서 거길 다시 접근하는 무시무시하고 소름끼치는 방법을 썼는데, 이번 글에서는 template의 힘을 빌린 멤버 변수 포인터를 써서 조금이나마 우아하고 안정적인 방법을 썼다. 하지만 현실은 `reinterpret_cast` [...]

실제 `ptr()` 함수 구현체는 그냥 object를 `field_impl_t` class가 아는 object type으로 강제 casting한 후, 거기서 찾고자 하는 멤버 field의 위치 주소를 찾아서 반환해주는 것이다.

`field_t`와 `field_impl_t`의 관계에서 볼 수 있듯이 둘은 object의 type으로는 엮여있지 않고, 덕분에 `reinterpret_cast`를 쓴다. 이 때문에 잘못된 object가 들어가면 굉장한 광경을 볼 수 있다! (게다가 실행해보기 전까지는 모른다는게 함정!)  
... 물론 `ref()` 함수의 반환 타입만 잘못 지정해도 무시무시한 일이 벌어진다.


이제 저 `field_t`를 관리하는 관리 class를 만들어보자. 귀찮으니까 코드를 먼저 보자.

```cpp
template <typename _Ty>
struct field_info_map_t {
protected:
    typedef _Ty impl_type;
    typedef std::map<std::string, field_t*> _info_map_t;
    static _info_map_t _info_map;

    template <typename _FieldTy, typename _FieldTy (_Ty::*Field)>
    static void _register_field(std::string name) {
        _info_map.insert(std::make_pair(name, new field_impl_t<_Ty, _FieldTy, Field>(name)));
    }
    
public:
    typedef std::map<std::string, field_t*>::iterator field_iterator_t;

    static field_t* get_field(std::string name) {
        return _info_map[name];
    }
    static field_iterator_t get_field_begin() { return _info_map.begin(); }
    static field_iterator_t get_field_end() { return _info_map.end(); }
};
template <typename _Ty>
typename field_info_map_t<_Ty>::_info_map_t field_info_map_t<_Ty>::_info_map;
```

지난 글에서 했던 것처럼, 동일하게 map을 사용해서 이름과 `field_t*`에 대한 정보를 가지고 있다. 특이한건 모든 멤버가 다 static인데 template parameter를 가지고 있다는 것이다. 그 이유는 CRTP를 써서 register 과정에서 어떤 type인지에 대한 정보를 생략하기 위함이다. (이는 실 사용 부분에서 자세히 보자.)

이제 각 field를 어떻게 등록할 것인지, helper macro를 먼저 보자.

```cpp
#define REGISTER_FIELD_BEGIN() \
    struct __register { \
        __register() { \
            static bool init = false; \
            if (init) return;

#define REGISTER_FIELD_END() \
        } \
    } _register_auto;

#define REGISTER_FIELD(type, name) \
            impl_type::_register_field<type, &impl_type::name>(#name);
```

역시 지난 글에서와 동일하게 struct 생성자 코드 + static 변수로 중복 실행 방지를 사용해서 해당 구조체에 접근할 때 바로 field 정보가 register 되도록 구성할 것이다.

재밌는 부분은 `REGISTER_FIELD` 부분이다. 이전 글과는 다르게 어떤 class인지에 대한 정보가 빠져있다. 그게 빠질 수 있는 이유는 실제 type을 언급하는 대신 `impl_type`이라는 이름을 사용하고 있기 때문인데, 이것을 위해서 `field_type_info_map_t`가 template parameter를 갖는 것이고, 그 type을 굳이 `impl_type`이라고 typedef 해 준 것이다.

즉, 멤버 포인터 변수를 작성할 때의 문법이 `className::*memberName`인데 className을 한 번 더 써주기 싫어서 만든 장치이다-_-;

이제 다 만들었으니까 사용해보자.

```cpp
struct user_t : field_info_map_t<user_t> {
    int index;
    std::string name;

    REGISTER_FIELD_BEGIN()
        REGISTER_FIELD(int, index)
        REGISTER_FIELD(std::string, name)
    REGISTER_FIELD_END()
};
```

`user_t`라는 구조체는 `index`, `name`라는 변수를 갖는다. 그리고 `REGISTER` 매크로를 통해 두 변수 모두 field 정보를 등록했다. 물론 매크로를 약간 고치면 지난 글처럼 매크로만으로 구조체 선언까지 가능해진다. 그런데 별로 그건 취향이 아니고-_- 구조체 내 변수가 깔끔하게 안 나온다. *(struct 변수 때문에 지저분해진다)*

좀 더 깔끔한 방법이 있을 것 같은데, 피곤하니 일단 저 정도에서 타협! 이제 다음과 같이 사용할 수 있다.

```cpp
user_t user;
user.index = 100;
user.name = "choi";
    
assert(user_t::get_field("index")->ref<int>(&user) == user.index);
assert(user_t::get_field("name")->ref<std::string>(&user) == user.name);

std::for_each(user_t::get_field_begin(), user_t::get_field_end(), [&] (std::pair<std::string, field_t*> pair) {
    printf("%s\n", pair.first.c_str());
});
```

`get_field()` 함수를 사용해서 대응되는 `field_t`를 가져올 수 있고, 거기에 객체의 주소를 넣어 값을 가져올 수 있다. 그리고 등록된 모든 field를 열거할 수 있다.

하지만 여기에는 지난 번 글에서와 마찬가지로 한 가지 문제점이 있다. 바로 `user_t`가 한 번도 생성된 적이 없다면 `user_t::get_field_begin()`, `user_t::get_field_end()`로 접근할 수 있는 field가 하나도 등록되지 않는다는 점이다. 즉, 무조건 `user_t` 객체가 한 번이라도 생성되어야 field가 등록된다는 것이다.

위 문제로 인해 deserialize를 제대로 수행할 수 없는 문제가 발생한다. 다음 글에서는 이 문제를 어떻게 해결할 수 있는지 알아보도록 하자.