---
layout: post
title: template을 사용한 generic 프로그래밍
tags: c++ template study -pub
---

*(한 번에 1~2시간 정도로 짧게(?) 하고 있다. 대충 accelerated c++ 책이랑 EC++ 책을 보고 있다.)*

C++ 언어를 가지고 C++스럽게 프로그래밍을 해보자! 는 어떤 의미일까?  
다양한 의견이 있겠지만, 프로그래밍 언어는 **표현력이 증가**하는 쪽으로 발전한다는 관점에서 프로그래머가 C에 비해서 보다 자신의 의도를 C++ 문법으로 잘 표현할 수 있는 방법으로 프로그래밍을 하는 의미가 아닐까라고 생각한다.

예를 들면 define 대신에 inline, const, typedef 등을 쓰는 것처럼.

프로그래머가 의도를 보다 명확히 표현해야 협업하는 사람이나 미래의 나와 오해가 덜 생기고 가독성도 좋고 버그도 적고 추후 유지보수하기도 좋다.

패턴을 사용하여 설계하는 것도 같은 맥락에 있다고 볼 수 있는데 문제는 그녀석들이 smalltalk나 java같이 enterprise한 언어에서 탄생한 녀석들이라, C++로 구현할 때 코드가 안드로메다로 가는 경우도 있다. 따라서 같은 설계를 C++스럽게 표현하기 위해 C++ 문법에도 익숙해지고, C++ 코드도 많이 읽어봐야한다.

즉, C++ 문법적 기능들을 사용해서 **코드는 최대한 간결하게! 의미는 명확하게!** 작성하는 것을 목표로 진행하고 있다.

### 명확한 의도 ###

명확한 의도를 전달하기 위해 기본적으로 지켜야할 규칙은 당연히 **이름 잘 짓기**다. 예를 들어 `operator ++` overloading 해서 빼기 연산을 수행하면 안 된다는 이야기다. 뭐 이런건 이야기할 필요도 없고.

모든 method를 public으로 가지는 class나 의미없는 getter/setter, 지역 함수인데 전역으로 공개된 함수 등, 해당 코드의 coverage가 비정상적으로 넓어서 그 의도를 파악하지 못하는 경우가 있을 수 있겠다. (함수 내에서 사용되는 모든 변수가 전역 변수라고 생각해보자!)

그러므로 객체지향이랍시고 학교에서 우리에게 주입한 *닥치고 class, 닥치고 getter/setter*의 세뇌에서 풀려나 의도에 맞는 함수와 class의 사용, 적절한 visibility를 고민해야 할 것이다.

그러기 위한 시작점이 static storage class이다.

### static storage class ###

이야기를 이어가기 위해 **[번역 단위](http://en.wikipedia.org/wiki/Translation_unit_%28programming%29)**에 대한 개념을 대충 알 필요가 있다. 번역단위는 컴파일러가 하나의 obj 파일을 만들어내기 위한 단위라고 보면 된다. c/c++의 경우 include한 header 파일들을 cpp에 다 복사해서 넣어놓고, 전처리기가 macro expand해주고, template engine이 template instantiation한 결과라고 보면 되겠다.

자, 그러면 이제 코드를 보자.

```cpp
// 전역공간
static MyClass svar1;
static void sfunc() {
    static MyClass svar2;
```

`svar1`과 `svar2`가 메모리에 할당되는 시점은 언제일까? 그리고 생성자가 불리는 시점은 언제일까? 둘 다 프로그램이 시작할 때 메모리에 할당되며, 생성자는 `svar1`일 경우 프로그램 시작 시, `svar2`일 경우 해당 함수가 처음 호출될 경우에 불리게 된다. `svar1`과 `sfunc`를 보면 static을 안 붙인 것과 차이가 없다고 생각할 수 있지만, static을 붙이게 되면 다른 번역 단위에서 extern keyword로 접근할 수 없게 된다.

요컨데 전역 변수 대신 함수 내 static 변수, 전역 함수 대신 static 함수를 써서 해당 변수/함수의 접근 범위를 줄일 수 있고, 이는 coverage를 줄일 수 있게 해주기 때문에 코드 유지보수하기 좋아진다는 소리.

### visibility ###

같은 맥락으로 public, protected, private 잘 지정하고, const 잘 붙이고, const reference 잘 쓰고, typedef 잘 걸어주는걸 습관들이자. 개인적으로 필요하다면 IN, OUT directive를 넣어주는 것도 괜찮다고는 생각함. 근데 move semantics가 있으니까 reference parameter보다는 반환으로 처리해도 괜찮을 것 같다. 그리고 메모리 관리할 대상이 아니면 const reference로 반환하고, 관리할 대상이라면 `shared_ptr`로 반환하고.

아무튼 등등 많이 짜고 많이 읽고 익숙해져서 의도를 명확히 표현하면 되겠다.

### binary_search ###

c++스러운 프로그래밍을 하기 위한 연습 첫 번째: `binary search`를 c++스럽게 작성해보자.

(과정 생략 결과 공개)

```cpp
template <typename _Iter>
_Iter midpoint(_Iter left, _Iter right) {
    while (true) {
        _Iter prevLeft = left++;
        _Iter prevRight = right--;
        if (left == right) return left;
        if (prevLeft == right) return prevLeft;
    }
}
template <typename _Iter, typename _Ty>
_Iter bsearch(_Iter begin, _Iter end, _Ty key) {
    _Iter left = begin, right = end;
    while (!(left == right)) {
        _Iter mid = midpoint(left, right);
        _Ty midValue = (*mid);
        if (midValue == key) return mid;
        else if (key < midValue) right = mid;
        else left = ++mid;
    }
    return right == end || *left != key ? end : left;
}
```

c++스럽게 작성해야 한다면 일단 class를 만들고 보는 경향이 있는데 이게 다 객체지향 수업에서 c++을 잘못 가르쳐서 그렇다. 뿐만 아니라 GoF design pattern같은 코드의 구현체가 워낙 enterprise하게 구현된걸 많이 봐서 일반화된 프로그래밍을 할 때 크고 아름다운 class와 interface의 조합을 구성하는 경우가 많다.

하지만 c++에는 template이라는 좋은 물건이 있으니 저걸로도 충분히 binary_search를 잘 구현할 수 있다.

* 최대한 일반화하여 작성하기 위해, container가 아닌 iterator 수준으로 받을 수 있도록 구현했다. 그리고 interface는 최대한 stl algorithm을 따라했다. (그래야 프로그래머가 외울게 줄어든다!)
* c++에는 operator overloading이 있으므로 다른 언어처럼 less_comparator 같은 추상화된 객체를 도입할 필요가 없다. 그냥 `< 연산자`를 쓰자.
* random access iterator를 쓰면 편하겠지만 일단 사용하는 연산자를 최소화하기 위해 `++`, `--`, `==`, `* 연산자`만 사용했다. 따라서 저 함수에 들어가는 iterator는 위 4개의 연산자만 있으면 된다.
	* key로 지정된 _Ty의 경우 <, == 연산자만 있으면 된다.

결국 하고 싶은 이야기는, ~~c++스럽게 프로그래밍을 하기 위해서는 template을 쓰자!가 아니라~~ c++의 문법을 잘 익혀놔서 가장 적합한 문법으로 구현하자는 이야기이다. 즉, 저걸 굳이 class로 프로그래밍할 필요도 없고, 그냥 일반 함수를 써서 활용도를 축소시킬 필요도 없다는 것이다.

물론 더 나아가서 random access iterator에 대해서도 효율적으로 동작할 수 있도록 위 코드를 수정할 수도 있다. iterator_tag와 template의 부분 특수화를 사용하거나 함수 overloading을 사용하면 간단하게 할 수 있다. 이 부분은 EC++ 책에도 잘 나와있으니 이 글에서는 생략하도록 하겠다.

당연한 이야기이지만 algorithm의 [binary_search](http://www.cplusplus.com/reference/algorithm/binary_search/)를 쓰는게 더 낫다. 이미 구현되어있는 것을 또 구현하지 않는 것이 제일 좋다! 그러므로 표준 라이브러리에 대해서는 틈틈이 알아두는게 좋다.

### 정리 ###

코드를 간결하게, 그리고 명확하게 작성하기 위해 가작 적합한 c++ 기능을 사용하는 것은 너무나 당연한 이야기다. 앞으로 남은 한 번 혹은 두 번의 기회 동안 그 이야기를 더 진행하면서 스터디를 진행하는 친구를 세뇌시킬 생각이다.

[if1live]님 방식으로 이야기하면 많이 짜고 많이 읽으면 된다. 그런데 [summerlight]님처럼 표준 문서를 읽으라고는 못하겠다(나도 귀찮아서 안 읽으니까!)

### 과제 ###

다음 이야기는 type erasure를 중심으로 진행할 예정이다.  
과제는 아래와 같다.

```cpp
int sum(int a, int b) { return a + b; }
void main() {
    Adapter<int /* return-type */, int /* 1st-arg-type */, int /* 2nd-arg-type */>
        functor1(sum, 100 /* 1st-arg */);
    int result1 = functor1(20); // 120
    int result2 = functor1(80); // 180
}
```

위와 같은 동작을 수행할 수 있는 Adapter class (혹은 struct)을 구현해보자.
