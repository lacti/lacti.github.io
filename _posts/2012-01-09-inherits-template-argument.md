---
layout: post
title: template 인자를 상속 받기
tags: c++ template -pub
---

```cpp
template <class _Base>
class MyClass : public _Base {};
```

위와 같은 형태가 어떤 의미를 지니고, 어느 곳에서 사용될 수 있는지 살펴보자

일단 자신의 부모 class를 generic하게 취할 수 있다는 것은 부모의 class 와 자식의 class 간의 결합성을 어느 정도 느슨하게 준다는 의미가 있다. (인자로 무엇을 주냐에 따라 상속 구조가 바뀌니까.)

또한 부모 class의 종류에 상관없이 동일한 기능을 추가해줄 수 있다거나, 아니면 부모 class들이 동일한 interface를 가지고 있다면, 그것을 통한 기능 확장도 가능하겠다.

### singleton ###

부모 class의 종류에 상관없이 동일한 기능을 추가하는 가장 간단한 예제는 singleton이다. 아래와 같은 `MyClass`가 있다고 해보자.

```cpp
class MyClass {
public:
    int GetValue() const { return 100; }
};
```

이 Class를 Singleton으로 만드려면 가장 간단한 방법은 직접 해당 method를 `MyClass`에 추가하는 것이다.

```cpp
class MyClass {
public:
    int GetValue() const { return 100; }

    static MyClass& Instance() {
        if (_ptr == nullptr)
            _ptr = new MyClass;
        return *_ptr;
    }
private:
    MyClass() {}
private:
    static MyClass* _ptr;
};
MyClass* MyClass::_ptr = nullptr;
```

물론 좋은 설계는 아니겠지만 만약 `Singleton` 객체가 많아진다고 해보자. 그러면 매번 저런 식의 static 함수와 변수를 각 class마다 추가해주어야 할 것이다.

이를 해결해주기 위한 여러 방법이 있겠지만 본 글에서 소개하고자 하는 방법은 다음과 같은 template singleton class를 만드는 것이다.

```cpp
template <class _Target>
class Singleton {
public:
    static _Target& Instance() {
        if (_ptr == nullptr) _ptr = new _Target;
        return *_ptr;
    }
private:
    static _Target* _ptr;
};
template <class _Target>
_Target* Singleton<_Target>::_ptr = nullptr;
```

위와 같은 `Singleton`을 설계하고 모든 문제가 해결되었다! 라고 생각하면 안된다. `MyClass`는 여러 instance가 생기면 안되기 때문에 생성자가 private으로 작성되어 있다.

하지만 위 `Singleton` class는 `new _Target`를 통해서 직접 해당 객체를 생성하므로, `Singleton<MyClass>::Instance()` 구문은  컴파일 에러를 발생시킬 것이다.

이를 해결하기 위해 다음과 같이 코드를 수정한다.

```cpp
template <class _Class>
class Singleton : private _Class {
public:
    static _Class& Instance() {
        if (_ptr == nullptr)
            _ptr = new Singleton<_Class>;
        return *_ptr;
    }
private:
    Singleton() {}
private:
    static Singleton* _ptr;
};
template <class _Class>
Singleton<_Class>* Singleton<_Class>::_ptr = nullptr;

class MyClass {
public:
    int GetValue() const { return 100; }

protected:
    MyClass() {}
};
```

`MyClass`의 생성자를 살짝 protected로 바꾸었다. 이제 `MyClass`를 상속받는 녀석이 아니면 저 객체를 생성하지 못할 것이다. 그리고 `Singleton` class가 이를 상속받는다.

단순히 생성하기 위한 상속을 받는 것이고, 기능 상속을 받을 필요는 없으므로 private 상속을 받는다. 그리고 `Singleton` 객체를 static 변수로 포함하고 있다가 이것을 `Instance()` 함수에서 `_Class&`로 변환해서 반환한다.

* 그 이유는 static 함수에서 `new _Class`를 수행할 때 여전히 `MyClass`의 생성자가 protected이므로 접근이 불가능하기 때문이다. 따라서 접근 가능한 자신의 생성자 `private Singleton()`를 부른다. `Singleton`의 생성자에서는 부모의 생성자인 `MyClass` 함수가 protected이므로 접근이 가능하다.

따라서 위와 같이 class를 설계하면, `Singleton<MyClass>::Instance()`와 같이 유일 객체에 접근이 가능하며, 그 객체 이외의 다른 객체의 생성도 막을 수 있다.

**하지만 이것으로도 완벽하지 않고, 여러 문제가 발생할 여지가 있다. 이에 대해서는 MC++D 의 6장 Singleton 구현을 보자**

### extension ###

부모 class들이 동일한 interface를 가지고 있다고 할 때, 이들에게 공통적으로 적용될 수 있는 기능을 추가한 class를 확장해보자.

약간 억지 예제이지만, STL container의 iterator를 확장해 보겠다.

```cpp
template <class _FwdIter>
struct for_each_iter : public _FwdIter {
    template <class _FuncTy>
    void for_each(_FwdIter end, _FuncTy funct) {
        for (_FwdIter it = begin; it != end; ++it)
            funct(*it);
    }

    for_each_iter(_FwdIter _begin) : begin(_begin) {}
    _FwdIter begin;
};
```

`for_each_iter`는 forward iterator 기능을 모두 가지면서 `for_each`라는 함수를 하나 더 갖는 iterator이다. 이를 만족하기 위해 `_FwdIter`에 대해 public 상속을 하였으며, `for_each` 함수를 추가로 갖는다.

단, 저렇게 만들어놓으면 매번 `for_each_iter<std::vector<int>::iterator>` 등 type을 길게 써주어야 한다. 이 문제를 해결하기 위해 간단하게 type을 추론하여 객체를 생성해주는 생성 함수를 만들자.

```cpp
template <class _FwdIter>
for_each_iter<_FwdIter> make_for_each_iter(_FwdIter iter)
{
    return for_each_iter<_FwdIter>(iter);
}
```

그러면 아래와 같이 사용할 수 있다.

```cpp
std::vector<int> ints;
ints.push_back(0); ints.push_back(1); ints.push_back(2); ints.push_back(3);

auto ea1 = make_for_each_iter(ints.begin());
ea1.for_each(ints.end(), [=] (int v) {
    _tprintf(_T("%d\n"), v);
});
```

부모 class들이 동일한 interface를 가지고 있고 그에 대한 동일한 작업을 수행하거나 결과를 제공하는 함수가 멤버 함수 형태로 제공되어 그것이 하나의 객체를 이루면 좋을 경우에 위와 같이 쓰면 될 것 같다.

하지만 보통은 algorithm에 있는 함수들처럼 그냥 함수를 만들어 쓴다. 만약 위와 같이 객체 형태로 표현할 때 장점이 있는 구조에서는 도움이 되지 않을까 싶다. (적절한 예제가 더 안 떠오른다-_-;)

### 마무리 ###

template 인자로 받게되는 것은 암시적 interface가 요구되기 때문에 컴파일 타임에서의 느슨한 결합이 요구될 때 쓰면 좋다. 그리고 상속이라는 것을 통해 기능 확장, 혹은 접근 제한 등을 적절히 혼합하여 사용하면 재미난 많은 것을 할 수 있다.

더 나아가서 [CRTP](http://en.wikipedia.org/wiki/Curiously_recurring_template_pattern)라는 재귀 상속의 개념도 있는데, 이건 다음 글에서 알아보도록 하자.