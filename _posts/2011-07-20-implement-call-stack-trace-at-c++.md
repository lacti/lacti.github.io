---
layout: post
title: MSVC call stacktrace 구현
tags: c++ -pub
---

이전에 Macro와 inline을 사용하여 log를 찍는 이야기를 했었다. 좀 더 나아가면 여러가지 재밌는 일을 할 수 있어 소개해보고자 한다.  
다룰 내용은 `__FUNCSIG__`와 `__if_exists`이다. Visual Studio 전용일거다. gcc 유저는 저리가라

지인의 이야기를 들어보니 x64에서 디버깅을 할 경우 Call Stack이 알 수 없게 쌓인다고 한다. 따라서 x64 용 디버깅을 위해 Call Stack Trace 를 만들어본다는 마음으로 글을 읽어보자

`__FUNCSIG__`는 Visual C++ compiler가 제공하는 [Predefined Macro](http://msdn.microsoft.com/en-us/library/b0084kay.aspx)중 하나이다.
말 그대로 Function Signature를 `const char *` 형태로 넣어주는 것이다. 컴파일러가 해당 함수를 parsing 하다가 `__FUNCSIG__`를 만나면, code generation을 할 때 그걸 그 Function Signature로 static한 `const char` 배열을 만들고 그 주소값을 넣어주는게 아닐까. 요즘은 신통하게 `_T()` 매크로랑 같이 쓰면 `wchar_t` 형태로도 준다. 만세!

[`__if_exists`](http://msdn.microsoft.com/en-us/library/x7wy9xh3.aspx)는 해당 지점에서 그 symbol이 존재하는지를 확인하기 위한 것이다. 당연히 컴파일러가 컴파일 단계에서 확인하는 것이고, 런타임 용은 아니다. `else` 를 쓸 수는 없고 `__if_not_exists`를 써야 한다.  
이 문서에서는 this symbol 여부를 확인하기 위해 쓸거다.

Call Stack 을 쌓기 위해 먼저 `StackElement`부터 만들어야한다. 가볍게, 파일명, 줄 수, this 주소 정도를 받아보자.

```cpp
struct StackElement
{
    LPCTSTR FileName;
    UINT    Line;
    LPCTSTR FunctionSignature;
    PVOID    This;

    StackElement(LPCTSTR fileName, UINT line, LPCTSTR functionSignature, PVOID _this = NULL)
        : FileName(fileName), Line(line), FunctionSignature(functionSignature), This(_this) {}
};
```

그리고 Stack을 구현해야하지만 귀찮으니까 `std::deque`를 쓰자.

```cpp
typedef std::deque<StackElement> CallStackType;
CallStackType CallStack;
```

만약 Multi-Thread환경에서 작업한다면 전역 변수로 Call Stack을 관리한다는건 미친 짓이다. 적절히 Thread 별로 자료구조를 구현하거나(index 를 발급한다던지), Tls를 써주는게 좋겠다. 이 내용은 다음에 다루자.

그러면 이제 해당 logging을 위한 매크로를 작성하는 일만 남았다.  
왜 매크로를 작성해야하냐 하면은, `__FILE__`, `__LINE__`, `__FUNCSIG__`와 `__if_exits`를 문맥이 변경되지 않게 사용해야 하기 때문이다. `inline function`을 쓰면 해당 function이 호출되어버리니까 함수 문맥이 바뀌어버려서 안된다.

고로 매크로를 써야한다.

```cpp
#define START_TRACE() \
    do { \
        PVOID __this = NULL; \
        __if_exists (this) { \
            __this = this; \
        } \
        CallStack.push_front(StackElement(_T(__FILE__), __LINE__, _T(__FUNCSIG__), __this)); \
    } while (false)

#define END_TRACE() \
    CallStack.pop_front()
```

약간 길어서 마음에 안 들기는 하다. 먼저 this symbol이 있는지 `__if_exists`로 검사한다. 있다면 그 주소를 `__this`변수에 넣고, 아니면 `NULL`로 유지한다. 그리고 `__FILE__`, `__LINE__`, `__FUNCSIG__`와 `__this` 정보를 `StackElement`에 담아서 CallStack 변수의 가장 위(push_front)에 넣는다.

그리고 함수 호출이 끝나서 빼는 경우에는 앞에서 뺀다(pop_front).

여기까지 읽다보면 실망하는 사람이 있을 것이다.
신통하게 뭔가 매크로만 하나 맨 위에 선언해두면 알아서 CallStack이 쌓이는 줄 알았는데, 이거 매크로를 각 함수마다 덕지덕지 발라야할 조짐을 느꼈기 때문일 것이다. 맞는 이야기이다.

간단한 예제를 보자.

```cpp
class Pot
{
public:
    Pot(void) : size(rand()) 
    {
        START_TRACE();
        END_TRACE();
    }
    int Size()
    {
        START_TRACE();
        END_TRACE();
        return size;
    }
private:
    int size;
};

int _tmain(int argc, _TCHAR* argv[])
{
    START_TRACE();

    for (int i = 0; i < 100; i++) {
        Pot pot;
        if (pot.Size() > 100)
            printf ("over 100!\n");
    }

    END_TRACE();
    return 0;
}
```

각 함수의 맨 위에 `START_TRACE()` 매크로를 사용하고, 함수가 끝날 때 `END_TRACE()` 를 사용한다. 그러면 Stack Trace 정보가 CallStack 변수에 쌓이는 것을 볼 수 있다.

하지만 위의 구조는 문제점이 있다. 알아챘는가? 아직이라면 한 5초 정도 생각해보자 -_-
답은 바로 밑에 이어진다.

위의 경우에서는 `END_TRACE()`를 안 불러준 채 함수를 탈출(return)해버리면 CallStack이 난장판이 된다. 즉, 위 방법은 결국 모든 return 구문 앞에다가 `END_TRACE()`를 붙여주어야 한다는 것.   `START_TRACE()`와 `END_TRACE()`를 붙여주는 것만으로도 엄청난 스트레스인데 이건 너무하다!

그런고로 이전 글에서 이야기한 생성자, 소멸자의 가호를 받아 위 문제를 RAII 방식으로 접근해서 풀어보도록 하자.  
`StackElement`의 생존을 관리하는, 즉 CallStack 변수에 생성할 때 `push_front`를 했다가 소멸할 때 `pop_front`를 하는 Functor 를 하나 만들자.

```cpp
struct StackElementPushFunctor
{
    StackElementPushFunctor(const StackElement& element)
    {
        CallStack.push_front(element);
    }
    ~StackElementPushFunctor(void)
    {
        CallStack.pop_front();
    }
};
```

이 Functor는 생성시 `StackElement`를 받아서 CallStack에 `push_front`로 앞에 넣어주고, 소멸될 때 `pop_front`로 빼준다. 그러면 함수가 시작할 때 이 객체를 만들었다가, 함수가 끝날 때 소멸시키면 되겠구나!

그래서 매크로가 다음과 같이 수정되어야 한다.

```cpp
#define TRACE() \
    PVOID __this = NULL; \
    __if_exists (this) { \
        __this = this; \
    } \
    StackElementPushFunctor __push__ (StackElement(_T(__FILE__), __LINE__, _T(__FUNCSIG__), __this));
```

직접 CallStack 변수에다가 `StackElement`를 넣었던 것과 달리 `StackElementPushFunctor`에 대한 객체를 하나 만든다. 이 때 Functor 객체가 함수 내에서 지역 변수로 존재하기 때문에 함수가 끝나면 알아서 소멸자가 호출되어 CallStack에서 현재 함수에 대한 `StackElement`가 빠져나간다.

덕분에 위의 `Object::size` 함수나 `_tmain` 함수에서 `END_TRACE`가 있었어야만 했던 것에 반해, 여기서는 아예 안 넣어도 되기 때문에 코드 작성하기도 한결 간단하다

```cpp
int _tmain(int argc, _TCHAR* argv[])
{
    TRACE();
    // 로직 코드
    return 0;
}
```

매크로 함수 형태로 들어가있으니까 상당히 어색한데, 그냥 함수 취급 안하고 () 를 빼버리도록 매크로를 만드는 것도 하나의 방법이겠다. 아무튼 위의 코드는 전처리기에 의해 다음처럼 변한다.

```cpp
int _tmain(int argc, _TCHAR* argv[])
{
    // this 얻기
    StackElementPushFunctor __push__ (/* 생략 */);

    // 로직 코드
    return 0;
    // 함수 scope 가 끝나므로 __push__::~StackElementPushFunctor() 호출됨
}
```

이렇게 CallStack 구축할 수 있고, DEBUG가 아닐 경우에는 그냥 TRACE 매크로를 빈 걸로 교체해두면 성능적 문제도 전혀 없겠다. 어차피 디버깅 용이니까.
