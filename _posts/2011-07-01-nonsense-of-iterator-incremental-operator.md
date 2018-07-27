---
layout: post
title: 반복자 i++과 ++i에 대한 헛소리
tags: c++
---

반복문에서 반복자를 증가시킬 때, `for ( ; ; i++)`과 `for ( ; ; ++i)`를 이야기할 때, 뭐가 빠르네 느리네 이야기가 왜 나왔을까?  
간단히 생각해보면, `i++`과 `++i`는 동작이 약간 다르다. 연산자 우선순위는 `i++`이 좀 더 빠르지만, 실행 측면에서 본다면

`i++`은

1. 자신의 상태를 저장한다
2. 자신의 상태를 변화한다
3. 저장한 예전 상태를 반환한다

`++i`는

1. 자신의 상태를 변화한다
2. 자신 자체를 반환한다.

`i++`의 3)과 `++i`의 2)를 보면 `i++`의 경우 복사해둔 것을 반환하지만, `++i`의 경우는 자기 자체(reference)를 반환한다. `i++++`은 안되지만 `++++i`는 되는 이유가 그것이다.  
함수 prototype으로 치자면

* 전항연산의 `int & operator ++ (void)`와 
* 후항연산의 `int operator ++ (int dummy)`의

차이랄까. 반환 값의 type이 다르다.

이게 단순 primitive type이면서 value type일 때는, `i++`의 3)과 `++i`의 2) 가 결국 복사된 값이므로 저기서 발생하는 부담은 같지만, 이를 수행하기 위한 instruction 차이가 난다.

하지만 이게 wrapper class에 의한 object이면 좀 달라진다.  
`i++`의 경우 반환하기 위한 임시 객체를 복사해서 준비해야하고, 자신을 변화시킨 후, 복사해둔 객체를 반환해야한다. 하지만 `++i`는? 그냥 자기 자신 (*this) 을 반환하면 된다.

객체의 복사라는게 객체의 크기에 따라 안드로메다급으로 걸릴 수 있는 일인데다가 `obj next = current++;`와 같이 작성할 경우

1. ++ 함수 내부에서 임시 객체 생성 위한 복사 1번
2. ++ 함수 반환 값에서 next 로 대입되기 위한 복사 1번
3. 재수없다면 next 객체 생성 따로 ++ 함수 반환 값 대입 연산 따로 까지 칠 경우 1번

총 2번 (컴파일러가 바보면 3번) 복사 짓을 해야한다는 것이다. 메모리도 그렇고 명령어도 그렇고 낭비가 심하다.

STL의 iterator 같은 걸 쓸 때 iterator는 object이다. 따라서 전항 ++ 이 후항 ++ 보다 성능이 빠르다는 이야기가 위 근거에 의해 성립되는 것이다.

자 그럼 이게 왜 헛소리인지 보자. 일단 **컴파일러가 그렇게 멍청하지 않다.**  
for 문에서 int 변수를 `i++` 하나 `++i` 하나 컴파일러가 바보가 아닌 이상에야 `INC instruction` 넣어주면 된다.

저게 iterator 같은 class라면?

```cpp
#include <iostream>
class serial {
public:
	serial & operator ++ (void) {
		std::cout << "prefix" << std::endl;
		return (*this);
	}
	serial & operator ++ (int dummy) {
		std::cout << "postfix" << std::endl;
		return (*this);
	}
};
int main (int argc, char* argv[])
{
	serial s;
	++++s;
	s++++;
	return 0;
}
```

재밌게도 후항(postfix) ++ 연산을 overloading할 때 반환 값에 대해서 신경을 쓰지 않아도 된다. 그런고로 전항(prefix) ++ 연산과 동일한 동작을 수행하게 하면 성능상 문제가 없다 할 수 있겠다.

물론, 

```cpp
serial & operator ++ (int dummy) { return ++(*this); }
```

와 같이 후항 연산에서 전항 연산을 호출해버려도 되고, (컴파일러가 함수 호출은 최적화시켜 줄거라 믿자)

Visual Studio 2010에서 해본 결과 아예 후항 ++ 연산 함수를 정의하지 않으면 알아서 전항 ++ 함수를 호출해버린다-_-
(g++ 4.5.2에서는 error: no 'operator++(int)' declared for postfix '++' 와 같이 에러를 띄운다)

그런고로 값 타입이든 객체 타입이든 반복문 등에서 반복자를 증가시킬 때 ++을 앞에 쓰냐 뒤에 쓰냐는 성능에 영향이 없다는 소리. 물론 컴파일러에 따라 다를 수 있다는 말이 제일 정답일 것이다만-_-