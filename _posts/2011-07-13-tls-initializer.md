---
layout: post
title: thread local storage 초기화
tags: c++ -pub
---

Tls는 `Thread Local Storage`로 Thread 내 전역변수라고 생각하면 간단하다(Local 인데 왠 전역!)  
즉, 그냥 global 영역에 선언하는 변수는 프로그램 내에 여러 Thread 가 공유하는 자원이 되지만, Tls 로 선언한 자원들은 해당 Thread 별로 따로 갖는다고 보면 된다.  
(이 때문에 strtok 같은 함수도 내부에서 static 변수를 써도 Tls 로 선언하면 Multithread 에서도 문제가 없다는 것)

그런데, Tls 는 생성자/소멸자가 정의된 객체에 대해 사용할 수가 없다. 따라서 primitive type, pointer, 그냥 구조체만 선언해서 쓸 수 있게 된다.

```cpp
__declspec(thread) int tlsValue;
__descspec(thread) struct {
    char header[32];
    char body[64];
    char tail[16];
} tlsChunk;
```

그 외의 객체를 쓰고 싶으면 객체의 포인터를 Tls 선언해서 각 Thread 마다 객체를 동적할당(new)하여 사용해야하는 것이다.

```cpp
typedef std::vector<std::string> Strings;
typedef Strings* StringsPtr;
__declspec(thread) StringsPtr tlsStrings;

void InitializeTls(void) {
    tlsStrings = new Strings;
}
```

만약 각기 다른 기능(모듈)의 여러 class가 존재하고, 그것들이 모두 Tls로 존재해야한다면 그 class에 대한 포인터 타입을 Tls로 선언한 다음에 그 객체들을 생성하기 위한 코드를 작성해야 할 것이다. Thread 모듈은 다른 각 모듈과 독립적이다. 즉, 뭐가 Tls 에 추가되든 말든 자신이 알면 안된다는 것이다.

예를 들어 Timer라는 모듈을 Tls로 갖는다고 하자. 그러면 Timer가 Tls구현을 위해 Thread를 아는 것은 당연한 이야기이지만, Thread 모듈 입장에서는 어떤 모듈이 Tls 를 하는지 알 수 없으므로 Thread가 Timer 혹은 다른 모듈을 알 수 없고, 알 필요도 없고, 의존성을 낮추기 위해서 알아서도 안 된다는 것이다.

왜 이런 장황한 이야기를 하냐면, 내가 본 코드가 아래와 유사한 구조이기 때문이다.

```cpp
#define __declspec(thread) TLS
TLS int tlsTimerIndex;
TLS TimerPtr tlsTimer;
TLS QueuePtr tlsQueue;
TLS TracerPtr tlsTracer;
```

이와 같이 한 파일에 Tls 관련 변수를 다 정의해놓고, 이것들에 대해 extern으로 해놓은 h 파일을 여기저기에서 include해서 쓰고 있다. 딱 보면 알 수 있지만 저 파일 선언하려면 Timer, Queue, Tracer를 모두 include해줘야 한다. 폭풍의존이 생긴다.

그리고 아래와 같이 Thread가 갖고 있는 static method인 `InitializeTls` 함수에서 Tls를 일괄 초기화해준다.

```cpp
class Thread {
public:
    static void InitializeTls (void) {
        tlsTimer = new Timer;
        tlsQueue = new Queue;
        tlsTracer = new Tracer;
    }
};
```

요약해서 말하자면, 위 방법은 전역으로 사용할 변수를 한 파일에 다 모아놓은 것이다. 그게 더 관리하기 쉽다고 생각할 수도 있지만, 적어도 나는 유지 보수와 에러 커버리지 측면에서 위 방법이 옳지 않다고 이야기하고 싶다.

Tls로 사용하는 `Queue`가 뭔가 잘못되었다. 그래서 새로운 `EnhancedQueue`를 작성해서 대체하려고 하는데, 단지 `Queue`가 정의된 파일만을 고치는 것이 아니라 저 Tls가 선언된 파일과 저 파일을 참조하게 되는 거의 모든 파일들을 의존폭풍에 함께 휘날리며 찾아다니면서 수정을 해야한다.  
즉, 수정 범위가 의존된 파일이라면, 전체 프로젝트를 대상으로 수정을 해야한다는 것이다.

새로운 모듈을 작성해서 Tls에 추가할 때는?  
역시 Tls가 옹기종기 모여있는 header 파일과 cpp 파일에 해당 값을 추가하고 `InitializeTls` 함수에 초기화해주는 구문을 추가하면 되겠다. 그런데 내가 지금 만든 모듈을 추가하려하는데 기존의 코드까지 고쳐야한다는게 상당히 거부감이 드는건 단지 내 성격상의 문제일런지 모르겠다

그래서 위 코드를 적어도 나같으면 이렇게 하겠다. 먼저, Tls 변수를 절대 전역적으로 노출시키지 않는다. Timer를 예로 들자면,

```cpp
class Timer {
public:
    static Timer& GetCurrentThreadTimer(void);
};
```

와 같이 static method로 interface를 노출시켜준다. 그리고 cpp 파일에서,

```cpp
__declspec Timer* tlsTimer;
Timer& Timer::GetCurrentThreadTimer(void) {
    return *tlsTimer;
}
```

와 같이 tls를 외부로 노출시키지 않은 채(즉 extern 을 쓰지 않고) 선언하고, 이를 static method를 통해 반환할 수 있게 해준다. 그러면 `Timer::GetCurrentThreadTimer()` 함수를 써서 얻는 객체는 Thread-safe하게 사용할 수 있는 Timer가 될 것이다.

그리고 Thread에서 Tls 초기화를 위해 약간 신경을 써준다.

```cpp
// thread.h
typedef void (*TlsInitializer) (void);
class Thread {
public:
    typedef std::vector<TlsInitializer> TlsInitializers;
    static void RegisterTlsInitializer(TlsInitializer initializer);
private:
    static TlsInitializers sTlsInitializers;
};

// thread.cpp
Thread::TlsInitializers Thread::sTlsInitializers;
void Thread::RegisterTlsInitializer(TlsInitializer initializer) {
    sTlsInitializers.push_back(initializer);
}
```

Thread의 static method인 `RegisterTlsInitializer` 함수를 통해서 Tls를 초기화하는 함수 포인터를 등록할 수 있다. 등록된 함수 포인터는 Thread의 static variable인 `sTlsInitializers`에 저장이 되고, Thread 객체가 생성될 때 이 vector에 저장되어있는 각 모듈별로 등록된 Tls 초기화 함수들이 호출되어 Tls를 초기화할 것이다.

그런데 여기까지 해도 여전히 Tls 초기화 함수를 `RegisterTlsInitializer` 함수의 인자로 호출해주는 시점이 문제다. Thread 객체가 처음 만들어지기 전까지는 각 모듈의 Tls 초기화 함수들이 등록되어야하기 때문이다.
따라서 아래와 같이 생성자 기반의 Functor를 만든다.

```cpp
struct TlsInitializerRegister {
    TlsInitializerRegister(TlsInitializer initializer) {
        Thread::RegisterTlsInitializer(initializer);
    }
};
```

이제 Tls Initializer 함수를 만들고, 그 함수 포인터를 인자로 저 객체를 생성해주면 된다.

```cpp
class Timer {
public:
    static void InitializeTls(void);
};
```

당연한 이야기이지만 함수 포인터의 원형이 `void (*) (void)`이므로 member method가 아닌 static method이다.
그리고 Timer.cpp에서 아래와 같이 전역 변수를 만들어준다.

```cpp
static TlsInitializerRegister _TimerTlsInitializerRegister (Timer::InitializeTls);
```

그러면 해당 전역 변수가 생성되면서 `Timer::InitializeTls` 함수가 Thread의 Tls 목록에 등록되는 것이다. 행여나 다른 파일 등에서 저 변수를 접근해서 쓰지 못하도록 static 으로 전역 변수를 선언했다.

초기화 함수 이름이나 등록 방법이 애매하면, Macro를 사용하여 코드를 찍어낼 수 있다.

```cpp
#define DECLARE_TLS_INITIALIZER() static void _InitializeTls(void)
#define IMPLEMENT_TLS_INITIALIZER(_ClassName) \
    static TlsInitializerRegister _##_ClassName##TlsInitializerRegister (_ClassName::_InitializeTls); \
    void _ClassName::InitializeTls(void)
```

그러면 아래와 같이 사용할 수 있다.

```cpp
// timer.h
class Timer {
public:
    DECLARE_TLS_INITIALIZER();
};

// timer.cpp
IMPLEMENT_TLS_INITIALIZER(Timer) {
    tlsTimer = new Timer;
}
```

개인적으로 최대한 설계로 깔끔함을 추구하려고 노력하는 편이고, 그 뒤에 Macro 등으로 가독성을 올릴 수 있다고 믿는 편이라 굳이 쓰지 않아도 되는 Macro를 도입한게 아닐까 하는 생각도 들기도 한다.

어쨌든 처음에 지적한 **한 파일에 몰아넣기** 보다는 위 방법과 같이 **모듈별 분리** 방법이 설계적 측면에서 더 낫다고 생각한다.