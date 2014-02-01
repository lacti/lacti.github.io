---
layout: post
title: template을 사용한 type간 동등성, 대입가능성
tags: c++ template -pub
---

* runtime에 `typeid`를 써서 객체 type의 동등성(Same)을 확인하고,
* `dynamic_cast`를 써서 객체간의 대입가능성(Assignable)을 확인할 수 있다.

하지만 이런 것을 확인하기 위해 runtime을 소모하는 것은 너무 아까운 일이다. 고로 template을 써보자.  
아래의 예제는 두 class, C1과 C2를 통해 진행된다.

```cpp
class C1 {};
class C2 : public C1 {};
```

### 동등성 확인 ###

type 간의 동등성을 확인하는 것은 매우 간단하다. template의 specialization을 쓰면 된다.

```cpp
template <class _Type1, class _Type2>
struct IsSame
{
	enum
	{
		value = false
	};
};

template<class _Type1>
struct IsSame<_Type1, _Type1>
{
	enum 
	{
		value = true
	};
};
```

`IsSame`을 사용할 때, 비교하는 두 class의 type이 다르다면 위 template이 사용될 것이다. 여기의 value 값은 false다.  
만약 두 type이 같다면, type이 같은 경우로 specialization 된 아래의 template이 사용된다. 따라서 value는 true이다.

```cpp
printf("%d %d %d %d\n", IsSame<C1, C1>::value, IsSame<C1, C2>::value,
                        IsSame<C2, C2>::value, IsSame<C2, C1>::value);
// 수행 결과: 1 0 1 0
```

이 모든 것이 compile time에 compiler가 판단해주므로 runtime 부담이 없다.

### 대입 가능성 확인 ###

대입 가능성(assignable)을 판단할 때는, 두 type을 from과 to로 나누어 생각하는게 편하다.  
FROM is assignable TO 라는 개념으로 생각해볼 때, TO가 base class, FROM이 derive class가 되는 것이다.

이걸 compiler가 판단해주려면 함수의 overloading 판정을 사용하면 된다.
compiler는 최대한 근접한 type의 인자를 갖는 함수를 호출해준다.

```cpp
template <class _From, class _To>
struct IsAssignable
{
private:
	typedef char IncorrectSize;
	typedef int  CorrectSize;

	static _From         Instantiate();
	static CorrectSize   Check(const _To&);
	static IncorrectSize Check(...);

public:
	enum
	{
		value = sizeof(CorrectSize) == sizeof(Check(Instantiate()))
	};
};
```

compiler가 compile time에 비교를 해야하므로 가장 만만한건 `sizeof` 연산자이다.  
크기가 다른 두 type을 반환하도록 적절히 typedef를 걸어두고, From type이 `const To&` 를 인자로 받는 Check와 그게 아닌 경우 `...` 중 어느 것이 호출되어 반환 값이 결정되는가를 보는 것이다. 그 반환 값의 type, 그리고 그 type에 대한 `sizeof` 는 모두 compile time에 결정될 수 있기 때문에 대입 가능한 경우에는 적절히 value가 설정될 것이다.

```cpp
printf("%d %d %d %d\n", IsAssignable<C1, C1>::value, IsAssignable<C1, C2>::value,
                        IsAssignable<C2, C2>::value, IsAssignable<C2, C1>::value);
// 수행 결과: 1 0 1 1
```

재밌는 것은 위 방법으로 Assignable을 판단할 경우 만능 `void*` 에 대해서는 모든 pointer type이 다 통과해버린다는 것인데, 그런 것은 위에서 구현한 `IsSame`과 적절히 섞어서 가려낼 수 있다.