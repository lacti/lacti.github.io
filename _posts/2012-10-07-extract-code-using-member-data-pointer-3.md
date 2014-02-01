---
layout: post
title: 멤버 데이터 포인터를 사용하여 연산식 묶어내기 3
tags: c++ refactor -pub
---

지난 두 글에서 사용한 전략은, 멤버에 접근하기 위한 방법을 동일한 인터페이스로 맞춰서 (첫 번째 글에서는 멤버 데이터 포인터, 두 번째 글에서는 멤버 함수 포인터) `BuffType`과 그 인터페이스를 대응시키는 방법을 사용하였다.

동일한 인터페이스를 사용하기 위해서 그들을 하나의 동일한 타입으로 지칭하는 방법을 사용하였고, 그렇기 때문에 서로 다른 type, int 변수와 float 변수, 그리고 그에 대한 배열 변수가 있을 때에는 사용할 수 없는 방법이었다.

```cpp
struct Stat {
    int hp;
    float attack;
};
typedef float Stat::*DataPtr;
DataPtr ptr = &Stat::hp; // Error!
```

이번 글에서는 형식 삭제([type erasure](http://en.wikipedia.org/wiki/Type_erasure))를 사용하여 보다 다양한 type을 지원하면서, 확장 가능한 방법에 대해 알아보도록 하겠다.


형식 삭제라고 하면 뭔가 어려워 보이지만, 그 결과물을 보면 굉장히 친숙하다. C++에서 형식 삭제를 하는 방법은 가상 함수를 통한 다형성을 사용하는 것인데, 예를 들면 다음과 같다.

```cpp
struct ValueHolder {
    virtual float GetValue() const = 0;
    virtual void SetValue(float value) = 0;
}
struct IntValueHolder : public ValueHolder {
    virtual float GetValue() const { return static_cast<float>(value); }
    virtual void SetValue(float _value) { value = static_cast<int>(_value); }
    int value;
```

`ValueHolder`는 concrete class가 어떤 값을 들고 있던, `GetValue()` 함수를 통해 float type의 변수를 반환하도록 하거나, `SetValue()` 함수를 통해 float 값을 받아서 자신의 값을 변경하도록 할 수 있는 interface이다.

이전 글과 이어서 생각해 볼때, 위와 같은 방법을 사용하여 int, float, 혹은 그에 대한 배열 멤버 변수들을 Get, Set 할 수 있도록 구조를 잡으면 이 문제를 해결할 수 있다는 이야기이다.


그런데 왜 형식 삭제라는 골치 아픈 용어를 사용할까?  
char, short, int, long, float, double에 대한 모든 type에 대해 ValueHolder concrete class를 작성하는 것은 매우 귀찮은 일이다. 그렇다면 template을 사용하여 그 귀찮음을 해결해보자.

```cpp
template <typename _Ty>
struct ValueHolderImpl : public ValueHolder {
    virtual float GetValue() const { return static_cast<float>(value); }
    virtual void SetValue(float _value) { value = static_cast<_Ty>(_value); }
    _Ty value;
```

이제 `ValueHolderImpl<>` class를 사용하면 float type과 `static_cast` 호환이 되는 모든 형식에 대해 `ValueHolder`를 만들 수 있다.

```cpp
ValueHolder* intHolder = new ValueHolderImpl<int>;
ValueHolder* floatHolder = new ValueHolderImpl<float>;
```

concrete class들은 `ValueHolderImpl<int>`와 같이 type 정보를 가진 채로 명시되지만 `ValueHolder` interface으로 지칭이 가능하다. 즉, runtime에는 concrete class의 type 정보 없이 그것들을 사용할 수 있게 되는 것이다.

덕분에 서로 다른 type인 `ValueHolderImpl<int>`, `ValueHolderImpl<float>`에 대해 `ValueHolder`라는 공통된 접근을 할 수 있고, compile-time에 존재하던 형식 정보(type information)가 runtime에서 제거되었으므로 이를 형식 삭제라고 하는 것이다.

이제 필요한 이론을 모두 습득하였으니 즐거운 코딩을 해보자. 형식 삭제를 위한 interface를 먼저 설계해보자.

```cpp
template <typename _Class>
class IAccessor {
public:
    virtual float GetValue(const _Class&) const = 0;
    virtual void SetValue(_Class&, float value) const = 0;
};
```

위 `ValueHolder`처럼 값을 넣고, 빼는 함수를 갖는다. 차이가 있다면, 이 Accessor 들은 구체적인 값을 가지는 것(Holding)이 아니라 멤버 데이터 포인터를 갖고, 특정 class의 instance를 인자로 받아 그 값을 넣고 빼는 구조라는 것이다. 일반적인 설계를 위해, 어떤 class에 대한 Accessor를 만들 것인지를 template parameter로 남겨두었다.

배열이 아닌 type에 대한 Accessor를 보면 이해하기가 쉽겠다. 다음 코드를 보자.

```cpp
template <typename _Class, typename _Ty>
class SingleAccessor : public IAccessor<_Class> {
public:
    virtual float GetValue(const _Class& obj) const {
        return static_cast<float>(obj.*dataPtr); 
    }
    virtual void SetValue(_Class& obj, float value) const {
        obj.*dataPtr = static_cast<_Ty>(value);
    }
    SingleAccessor(_Ty _Class::*_dataPtr)
        : dataPtr(_dataPtr) {}
private:
    _Ty _Class::*dataPtr;
};
```

생성자로 멤버 데이터 포인터를 받는다. 그리고 그 멤버 데이터 포인터가 어떤 type일지는 template parameter로 남겨둔다. 그리고 Get/SetValue 함수에서 object를 받아 자신이 가지고 있는 멤버 데이터 포인터를 사용하여 값을 가져오거나, 지정하는 작업을 수행한다.

이제 이 `SingleAccessor`를 사용하여 int 변수이든, float 변수이든 멤버 변수의 type에 상관없이 접근할 수 있는 `IAccessor`를 만들 수 있는 것이다.

멤버 변수의 타입이 배열인 것은 배열에 대한 크기와, 몇 번째 element에 접근할지에 대한 index 값이 같이 필요하다.

```cpp
template <typename _Class, typename _Ty, size_t _Size>
class ArrayAccessor : public IAccessor<_Class> {
public:
    virtual float GetValue(const _Class& obj) const {
        return static_cast<float>((obj.*arrayPtr)[index]);
    }
    virtual void SetValue(_Class& obj, float value) const {
        (obj.*arrayPtr)[index] = static_cast<_Ty>(value);
    }
    typedef std::array<_Ty, _Size> _Class::*ArrayPtrType;
    ArrayAccessor(ArrayPtrType _arrayPtr, int _index)
        : arrayPtr(_arrayPtr), index(_index) {}
private:
    ArrayPtrType arrayPtr;
    int index;
};
```

`GetValue`/`SetValue` 함수의 구조는 `SingleAccessor`와 크게 차이가 없다. 배열 타입의 멤버 데이터 포인터 변수와 index를 생성자로 받아서 가지고 있고, `GetValue`/`SetValue` 함수가 불리는 시점에 해당 배열의 위치에 접근하여 값을 가져오거나 넣는다.

이제 Accessor들과 enum 값을 연관지어 관리할 관리자를 만들어보자.

```cpp
template <typename _Class>
class AccessorManager {
public:
    typedef std::shared_ptr<IAccessor<_Class>> AccessorImpl;
    typedef std::map<int, AccessorImpl> AccessorImplMap;

    template <typename _Class, typename _Ty>
    void Register(int type, _Ty _Class::*dataPtr) {
        implMap.insert(std::make_pair(type, new SingleAccessor<_Class, _Ty>(dataPtr)));
    }
    template <typename _Class, typename _Ty, size_t _Size>
    void Register(int type, std::array<_Ty, _Size> _Class::*arrayPtr, int index) {
        implMap.insert(std::make_pair(type,
            new ArrayAccessor<_Class, _Ty, _Size>(arrayPtr, index)));
    }
    AccessorImpl operator [] (int type) {
        assert(implMap.find(type) != implMap.end());
        return implMap[type];
    }
private:
    AccessorImplMap implMap;
};
```

`AccessorManager`는 int(BuffType)와 `shared_ptr<IAccessor>`의 map을 갖고 이들을 `Register` 해주거나 enum 값으로 `IAccessor`를 찾아주는 작업을 한다.

재미있는 것은 `Register()` 함수들이다. `Register()` 함수는 인자로 들어오는 값을 통해 template parameter들이 deduce하고, 이렇게 deduce된 template parameter들을 `SingleAccessor`나 `ArrayAccessor`의 template parameter로 넘겨준다.

이제 다음과 같이 쓸 수 있다.

```cpp
AccessorManager<Stat> manager;
manager.Register(BUFF_HP, &Stat::hp);
manager.Register(BUFF_RUN_SPEED, &Stat::movingSpeed, MST_RUN);
```

첫 번째 `Register` 호출은 `SingleAccessor`를 생성하는 `Register` 함수가 호출된다. 그리고 `hp` 멤버의 type이 적절히 deduce되어 `SingleAccessor`가 만들어진다.

두 번째 `Register` 호출은 `ArrayAccessor`를 생성하는 `Register` 함수가 호출된다. 그리고 `movingSpeed` 멤버 type과 배열의 크기가 적절히 deduce되어 `ArrayAccessor`가 만들어진다. 이 때 index인 `MST_RUN`이 같이 `ArrayAccessor`로 전달되어, `BUFF_RUN_SPEED` 의해서 `movingSpeed[MST_RUN]`의 값을 제어할 수 있게 되는 것이다.

생각해보니, 이러한 Manager class는 전역으로 하나만 있으면 좋겠다. 따라서 다음과 같이 간단한 singleton을 만들어서 써보자.

```cpp
template <typename _Class>
AccessorManager<_Class>& Accessor() {
    static AccessorManager<_Class> instance;
    return instance;
}
```

이는 thread-safe하지 않을 수 있는데, `AccessorManager`에 `Register` 하는 과정은 처음 프로그램이 초기화될 때 딱 한 번만 수행하면 되는 작업이고, 그 이후에는 전부 `operator []`로 access만 하면 되므로 thread-safe를 걱정할 필요는 없어 보인다.

이제 지난 글에서 정의한 `BUFF_ENUM`과 `BUFF_ENUM_A`를 다음과 같이 정의하여 마무리를 지어보자.

```cpp
#define BUFF_ENUM(type, member) Accessor<Stat>().Register(type, member);
#define BUFF_ENUM_A(type, member, index) Accessor<Stat>().Register(type, member, index);
#include "BuffType.inl"
#undef BUFF_ENUM
#undef BUFF_ENUM_A
```

BuffType.inl의 내용은 지난 글과 동일하다. 이제 위와 같은 코드가 프로그램이 시작될 때 수행될 수 있도록 전역 구조체 변수의 생성자로 넣어놓는 방법 등을 사용하여 잘 배치해두면, Stat 구조체 내의 변수와 BuffType을 엮을 수 있다는 것이다.

매번 `AccessorManager`에게 enum 값을 넘겨서 `IAccessor`를 받은 후, 그 `IAccessor`와 `Stat` 구조체 변수를 엮어서 값을 주고 받는 코딩을 하는 것은 너무 더럽고 귀찮다. 따라서 간단히 이 둘을 연결해줄 수 있는 `Accessible`을 만들어보자.

```cpp
template <typename _Class>
class Accessible {
public:
    Accessible(_Class& _object)
        : object(_object) {}
    float GetValue(int type) {
        return Accessor<_Class>()[type]->GetValue(object);
    }
    void SetValue(int type, float value) {
        Accessor<_Class>()[type]->SetValue(object, value);
    }
    Accessible(const Accessible& that)
        : object(that.object) {}
private:
    Accessible& operator = (const Accessible&);
private:
    _Class& object;
};
```

`Accessible`은 class를 template parameter로 받고, `IAccessor`를 통해 접근할 object를 멤버로 갖는 class이다. 그리고 `Accessor<>`를 통해 `IAccessor`를 불러와서 멤버로 가지고 있는 object와 연결하여 `GetValue`/`SetValue`를 할 수 있게 만들어준다. 

이제 다음과 같이 사용할 수 있다.

```cpp
Accessible<Stat> accessible(stat);
switch (buffMethod) {
case METHOD_SET: accessible.SetValue(buffType, buffValue); break;
case METHOD_ADD: accessible.SetValue(buffType, accessible.GetValue(buffType) + buffValue); break;
case METHOD_RATE: accessible.SetValue(buffType, accessible.GetValue(buffType) * buffValue); break;
}
```

그렇다면 이것이 지난 번 방법에 비해 왜 더 느릴까?
지난 글에서 서술한 방법들은 멤버 데이터 포인터나 멤버 함수 포인터를 사용하여 객체의 지정된 값을 가져오거나 지정하는 방법이었다. 만약 `Stat` 구조체가 POD 형태라면, 이들은 offset에 의한 데이터 접근을 하게 되거나 function-call 1번 수행(그나마도 inline 화 될 수 있는)하면 끝나는 형태이다.

그렇지만 이번 글에 소개된 방법은 `IAccessor`라는 interface를 통해 concrete의 동작을 위해 vfptr을 사용하는 방식으로 가상 함수 호출을 위한 부담을 추가로 가지게 되는 것이다. 이 호출 부담 때문에 더 느릴 수 밖에 없는 것이다.

다 쓰고 보니 `AccessorManager`가 굳이 map을 사용하지 않고, `BUFF_MAX`를 받아 배열로 `IAccessor`를 관리하는 것이 더 낫겠다 싶다. 하지만 굳이 위와 같이 냅둔 이유는 [c++에서 reflection 사용하기 3]({% post_url 2012-06-09-using-reflection-at-cpp-3 %})와 형식이 유사해지기 때문에 코드 읽기가 좀 더 나을지도 모르겠다는 생각과, `AccessorManager`에서 배열의 크기를 template parameter로 받아서 배열을 생성해주기 약간 귀찮았기 때문이다-_-a