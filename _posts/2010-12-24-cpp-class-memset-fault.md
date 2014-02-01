---
layout: post
title: class와 memset
tags: c++ -pub
---

c++의 class보다 java의 class를 훨씬 많이 쓰는 나는 사실 c의 struct라면 모를까 c++의 class는 아직도 생소하다. struct를 쓸 때, 가장 좋은 점 중 하나는 초기화라고 생각하는데,

```cpp
struct MyData {
    TCHAR szName[128];
    UINT   nValue;
    BOOL  bBolean;
    LPVOID lpBuffer;
};
MyData data = { 0, };
```

와 같이 선언과 동시에 초기화를 할 수가 있어 만약 모든 값을 `NULL(or 0)`으로 채우려면 class의 생성자 초기화리스트 보다 간단하게 할 수 있다는 것이다.

여기에 더 나아가

```cpp
struct MyData {
    // some variables;
    MyData (void) { memset (this, 0, sizeof (*this)); }
};
```

와 같은 방법으로 생성과 동시에 해당 구조체를 초기화할 수도 있다.

하지만 이 방식은 적어도 c까지는 유효했으나 c++부터는 그렇지 못하다. 왜냐하면 c++은 눈에 보이는 variable 외에도 virtual 함수에 의한 다형성을 위한 vfptr(virtual function pointer table)이 있기 때문이다.

class를 설계할 때 상속을 고려한다면, 다른건 몰라도 꼭 virtual로 선언해야하는게 바로 소멸자(destructor)이다. 그런데 이렇게 하나라도 virtual function을 가지게 된다면 컴파일러는 class 내부에 vfptr을 집어넣어주게 되고, 이 class를 위와 같은 memset으로 sizeof 잡아서 일괄 0으로 초기화하면 vfptr도 전부 NULL이 들어간다.

뭐 virtual function 호출 안하면 상관없다만 그렇다고 소멸자 호출을 막으면 안 되니까 [...]

그렇다고 초기화리스트를 사용하는건 자존심이 허락하지 않는다. 멤버 변수 쓸데없이 많은 것도 짜증나는데 어째서 초기화리스트에서 한 번 더 써주는 수고를 해야하는가?

물론 이를 해결할 수 있는 방법?이랄게 있기는 하다. 방법은 다음과 같다.

1. 초기화하고 싶은 변수를 struct로 따로 묶고 struct 생성자에서 memset을 사용하여 초기화한다.
2. 그리고 이걸 사용할 class가 본 struct를 protected로 상속받는다-_- 
3. 행여나 member를 private로 만들고 싶다면 private으로 상속받는다.

자, 이제 memset으로 변수도 초기화했고 class의 vfptr도 안전하다. 이렇게 주구장창 생성되는 struct의 이름만 잘 관리하면 [...........]

이를 보여주는 간단한 예제 코드는 다음과 같다.

```cpp
struct Context {
	TCHAR	szData[1024];
	LPVOID	lpBuffer1;
	LPVOID	lpBuffer2;
	LPVOID	lpBuffer3;
	UINT	nValue;

	Context (void) { memset (this, 0, sizeof (*this)); }
};

class CParent: protected Context {
public:
	CParent (void) {}
	virtual ~CParent (void) {}

	virtual UINT GetValue (void) const = 0;

private:
};

class CChild: public CParent {
public:
	CChild (void) {}
	virtual ~CChild (void) {}

	virtual UINT GetValue (void) const { return nValue; }
private:
};


int _tmain(int argc, _TCHAR* argv[]) {
	CParent *lpObject = new CChild;
	std::cout << lpObject->GetValue () << std::endl;
	return 0;
}
```
