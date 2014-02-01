---
layout: post
title: 객체별 함수 수행 동기화
tags: concurrency c++ async -pub
---

(주의, 아래 글은 Visual Studio 2010 을 쓴다는 가정하에 작성하였다. 아무튼 C++11 이 지원되어야 한다)  
여러 Thread가 동시에 접근을 수행하는 객체를 보호하기 위해서는 어떤 방법이 있을까?

* lock을 건다
* 각 Thread들은 하나의 queue에 요청할 작업을 쌓아두고, 그 객체 전담 Thread가 그 작업들을 처리한다.
* Read / Write Phase를 나누어서 Read는 다같이, Write는 역시 작업을 모아 하나의 Thread만 진입하여 처리한다.

lock을 걸면 당연히 속도가 떨어진다. 따라서 본 글에서는 lock을 걸지 않는 방법을 논의해볼 것이고 설계적으로 복잡한 3번 보다는 2번에 초점을 맞출 계획이다.

상황적으로 볼 때, 하나의 객체에 여러 Thread가 접근할 일은 많다. 만약 2명의 User가 Party를 맺고 사냥을 하다가, 각자 동시에 한 마리씩 몬스터를 잡았다는 message가 동시에 Server에 도착해 경험치를 각 User 객체에 넣어준다고 하자.

User에는 AddExp함수를 통해 내부에 경험치를 증가시킨다. 그런데 만약 두 Thread가 경쟁적으로 AddExp를 호출할 경우, 결과 값이 제대로 들어간다는 보장이 없다. [volatile과 interlocked operation]({% post_url 2011-08-02-volatile-interlocked-operation %})

물론 이런 경우는 InterlockedAdd 함수를 써서 해결할 수도 있겠지만, 공유 객체에 요청되는 작업들을 Queue에 모아 동기적으로 하나의 Thread 가 처리하는 방법으로 문제를 해결해보도록 하자

### 설계 ###

생산자와 소비자 모델에서 생산자와 소비자는 Queue 객체를 공유한다. 생산자가 데이터를 Queue에 넣으면 소비자는 Queue에서 데이터를 꺼내서 처리한다. 이 때 데이터가 공유 객체에 요청하는 작업이고, 소비자가 단일 Thread로 구성된다면, 여러 Thread에서 요청하는 작업들을 Queue에 넣어 소비자, 즉 단일 Thread가 처리하므로 공유 객체는 Lock 없이 Thread Safe하게 돌아가게 된다.

위에서 언급한 경쟁적 상황에서 값이 제대로 반영되지 않는 문제도 있고, STL의 경우 Container를 변경시킬 경우 Iterator가 무효화될 수 있으므로 여러 Thread가 접근할 때에는 반드시 Lock을 걸어서 보호를 해주어야하는데, 이러한 부담을 제거할 수 있다는 것이다.

### InterlockedExchange ###

공유 객체에 작업을 요청하는 Thread는 많다. 하지만 실질적으로 이 작업들을 처리하는 Thread는 단 하나다. 그렇다고 객체마다 Thread를 다 만들 수는 없다. 가장 좋은 해결책은 어떤 것일까?

Lock을 생각해보자. Lock이라는 것은 여러 Thread가 접근해서 수행하는 영역의 시작과 끝에서 `Lock`, `Unlock`을 사용, 그 구간을 상호 배타적 구간(Mutual Exclusion)으로 설정하여 Thread가 동시에 접근하지 못하도록 보호하는 장치이다.  
즉, `AcquireLock` Logic은 여러 Thread가 동시에 접근하여 수행할 수 있지만, 실제로 그 routine을 벗어나 Mutex에 진입하여 코드를 실행하는 Thread는 하나로 보장이 된다. 아래의 간단한 `SpinLock` 예제를 보자 (Windows via C/C++)

```cpp
void SpinLock::Lock(void) {
    while (InterlockedExchange (&mLockFlag, 1) == 1)
        Sleep (0);
}
void SpinLock::Unlock(void) {
    InterlockedExchange (&mLockFlag, 0);
}
```

`InterlockedExchange`는 원자적으로 해당 변수에 값을 대입하고 그 변수의 초기값을 반환하는 연산이다. `SpinLock`은 처음에 `mLockFlag`가 0 이다. 따라서 누군가 `Lock` 함수를 요청하면 `mLockFlag`의 값을 1로 바꾸고, 0 (초기값) 을 반환한다. 따라서 바로 함수 수행이 종료된다.  
하지만 다른 Thread가 동시에 `Lock`을 요청할 경우 `InterlockedExchange` 함수는 1을 반환할 것이고, 그렇다면 무한 loop 를 돌면서 `Sleep (0)`, 즉 다른 Thread에게 수행 시간을 양보한다 (물론 자신보다 우선순위가 같거나 높은 Thread들에 대해서)

위 방법을 사용하여 어떠한 함수에 진입하는 Thread 의 단일성을 보장할 수 있겠다. 따라서 저 방법을 사용하여 문제를 해결해보자.

### bind function object ###

함수를 수행하려면, 적어도 함수의 주소와 각 인자에 대해 알아야한다. 만약 함수가 특정 객체의 멤버 함수라면, 멤버 함수의 주소와 해당 객체가 필요할 것이다.

함수는 각기 다른 형태(signature)을 갖고 있고, 수행에 필요한 인자가 각기 다르다. 따라서 모든 함수의 요청을 객체화(functor) 하기 위해서는 동일한 interface 로 함수 요청을 통일시켜줄 필요가 있다. 이러기 위해 사용하는 것이 std::bind 이다.
아래의 예제는 각 함수의 요청을 무항 함수 객체(nullary functor)로 변환하는 코드이다.

```cpp
int add(int a, int b) { return a + b; }
struct Adder {
    int add(int a, int b) { return a + b; }
};
// ...
Adder adder;
auto functor1 = std::bind(&::add, 10, 20);
auto functor2 = std::bind(&Adder::add, &adder, 10, 20);
functor1();
functor2();
```

정확한 type 은 표기하기 어렵지만, 아무튼 함수 수행에 대해 함수의 주소와 객체, 그리고 인자까지 완벽하게 하나의 객체로 묶을 수 있게 되었다.

### general functor ###

하지만 이건 compile time에 가능한 일이고, 저것들을 runtime에 한군데 모아놓고 수행하기는 어렵다. runtime에 객체들을 모아놓는다는 것은 하나의 Container에 객체들을 담아두고 iterating을 한다는 것인데 저것들의 type은 모두 다르기 때문이다. 따라서 type을 맞춰주기 위해 interface를 작성한다.

```cpp
struct RequestJob
{
    virtual void operator () (void) = 0;
    virtual ~RequestJob() {}
};
```

그리고 간단한 template 함수를 통해 함수 호출 요청 객체를 받아 저 interface를 상속받은 struct를 생성하도록 한다. 함수 내에서 template struct를 갖을 수는 없지만 함수 자체가 template이면 문제가 해결된다.

```cpp
template <typename _Functor>
void Request(const _Functor& functor)
{
    struct _RequestJobImpl : public RequestJob
    {
        _RequestJobImpl(const _Functor& functor)
            : mFunctor (functor) {}
        virtual void operator () (void) { mFunctor(); }

        _Functor mFunctor;
    };
    mJobQueue.push(RequestJobPtr(new _RequestJobImpl(functor)));
```

당연한 이야기이지만 가상 소멸자가 중요하다. 객체에 대한 함수 수행이 지금 바로 수행되는 것이 아니라 요청되어 언제 수행될지 모르는, 즉 비동기적 수행을 요청하는 것이기 때문에 그때까지 객체가 살아있으리란 보장이 없다.

따라서 `shared_ptr` 같은 것을 써야하는데, `RequestJob struct`가 가상 소멸자를 갖지 않으면 `_RequestJobImpl struct`의 멤버 변수인 `_Functor`가 소멸되지 않고, 그러면 `shared_ptr`의 Reference Count가 감소하지 않아 메모리 누수가 발생하게 된다.

아무튼 저렇게 inner struct로 `_RequestJobImpl struct`를 만들어서 template type인 `_Functor` 객체를 멤버로 갖고, `operator ()`에서 그 함수를 호출해줄 수 있도록 한다. 그렇게 만든 `RequestJob` 객체를 `JobQueue`에 넣는다.
물론 `JobQueue`는 여러 Thread에서 동시에 Push를 수행하고, 다른 Thread에서 Pop을 수행해야하므로 thread safe해야한다. 따라서 concurrent_queue.h에 정의된 `Concurrency::concurrent_queue`를 사용한다.

```cpp
typedef Concurrency::concurrent_queue<RequestJobPtr> JobQueue;
JobQueue mJobQueue;
```

### single entrance ###

마지막으로 `JoqQueue`에 들어간 작업을 처리할 Thread 1개만 통과시켜서 Queue에 들어있는 작업을 처리하게 해야한다. `SpinLock`에서 공부했던 내용을 `Request` 함수 뒤에 끼얹어보자.

```cpp
    if (InterlockedExchange (&mExclusiveFlag, 1) == 1)
        return;
        
    for (RequestJobPtr job = NULL; mJobQueue.try_pop(job) && job != NULL;)
    {
        (*job)();
        delete job;
    }
    InterlockedExchange(&mExclusiveFlag, 0);
}
```

`InterlockedExchange` 함수를 사용해서 `mExclusiveFlag` 값을 통해 한 개의 Thread만 통과시킨다. 나머지는 어차피 수행해야할 작업들을 `JobQueue`에 추가시켰으니 마음놓고 `Request` 함수를 나온다.

진입에 성공한 Thread는 이제 독박을 쓴다. `JobQueue`가 빌 때까지 `RequestJob` 객체를 하염없이 꺼내서 수행을 해준다. 물론 수행 후 job 객체를 제거하는 것도 잊지 않는다. 이 때문에 Thread가 작업을 처리하는 동안 다른 Thread들이 계속 `JobQueue`에 작업을 채워주면 그 Thread는 이 함수를 못 빠져나올지도 모른다.

하지만 상식적으로, 그런 경우는 대부분 일어날 수 없다. 왜냐하면 객체의 수정을 촉발하는 네트워크 IO 작업의 속도보다 작업을 처리하는 속도가 더 빠르기 때문이다. 그럼에도 불구하고 너무 많은 작업이 몰린다면, 그 Thread는 적절한 tuning을 통해 몇 초만 `JobQueue`를 처리하다가 안되면 그냥 반환하고 나오면 될 일이다. 그럼 다음 Thread가 진입해서 이어서 할테니까.

### 예제 ###

이제 모든 준비가 끝났다. 공유되어 여러 Thread로부터 처리가 동시에 일어날 수 있는 class는 위 class를 상속받으면 된다. `User` class가 위 class를 상속받았고, User 객체가 `AddExp` 함수를 가질 때, 다음과 같은 방법으로 요청할 수 있다.

```cpp
typedef std::shared_ptr<User> UserRef;
UserRef user = UserRef (new User);
user->Request (std::bind (&User::AddExp, user, 100));
```

User 객체에게 멤버 함수 수행 요청을 `Request` 함수를 통해 전달한다. 수행에 필요한 정보는 `std::bind`로 묶어줬다. 한 가지 아쉬운 점은 Request를 부르는 대상이 이미 user 객체로 정해졌으므로 `User::AddExp`를 수행할 대상도 Request를 요청한 user 객체인데, `std::bind`를 묶어줄 때 두 번째 인자로 이 `AddExp` 함수를 수행할 객체인 user 객체를 한 번 더 넣어줘야한다는 것이다.

이 문제에 대해서는 딱히 좋은 방법이 없는 것 같다.  
(UserRef는 User에 대한 `shared_ptr`로 분명 `User::AddExp` 함수를 수행하기 위해서는 `User *` 를 인자로 받아야하지만 `shared_ptr`은 원본 Type 에 대한 casting operator를 overloading 했으므로 문제가 없다.)


예제 코드 전문을 보자.

```cpp
#include <windows.h>
#include <functional> 
#include <algorithm> 
#include <iostream>
#include <concurrent_queue.h>
#include <vector>

class RequestBase
{
private:
    struct RequestJob
    {
        virtual void operator () (void) = 0;
        virtual ~RequestJob() {}
    };
    typedef RequestJob* RequestJobPtr;

public:
    template <typename _Functor>
    void Request(const _Functor& functor)
    {
        struct _RequestJobImpl : public RequestJob
        {
            _RequestJobImpl(const _Functor& functor)
                : mFunctor (functor) {}
            virtual void operator () (void) { mFunctor(); }

            _Functor mFunctor;
        };
        mJobQueue.push(RequestJobPtr(new _RequestJobImpl(functor)));

        if (InterlockedExchange(&mExclusiveFlag, 1) == 1)
            return;
        
        for (RequestJobPtr job = NULL; mJobQueue.try_pop(job) && job != NULL;)
        {
            (*job)();
            delete job;
        }
        InterlockedExchange(&mExclusiveFlag, 0);
    }
    RequestBase(void)
        : mExclusiveFlag(0) {}

private:
    typedef Concurrency::concurrent_queue<RequestJobPtr> JobQueue;
    JobQueue mJobQueue;
    LONG     mExclusiveFlag;
};

class User : public RequestBase
{
public:
    void AddExp(int exp)    { mExp += exp; }
    int  GetExp(void) const { return mExp; }

    User(void) : mExp(0) {}
    ~User(void) {}

private:
    int mExp;
};

typedef std::shared_ptr<User> UserRef;

int _tmain(int argc, _TCHAR* argv[])
{
    typedef std::vector<UserRef> Users;
    Users users;

    users.push_back(UserRef(new User));
    users.push_back(UserRef(new User));
    users.push_back(UserRef(new User));
    users.push_back(UserRef(new User));

    std::for_each(users.begin(), users.end(), [=] (UserRef& user) {
        user->Request(std::bind(&User::AddExp, user, (rand() % 7) * 1000));
    });
    
    std::for_each(users.cbegin(), users.cend(), [=] (const UserRef& user) {
        std::cout << "Exp (" << user->GetExp() << ")" << std::endl;
    });

    users.erase(users.begin(), users.end());
    return 0;
}
```

### 정리 ###

멀티 Thread 프로그래밍에서 Lock 없는 코드를 작성하는 것은 성능적으로 꽤나 중요한 일이다. 따라서 위와 같은 방법을 통해 공유 객체에 대한 수행을 보호하는 것도 좋은 방법일 것이다.

물론 위 구조를 사용하기 위해서는 비동기적으로 로직을 구성해야할 것이고, 물론 이게 만만한 작업은 아니다. 그에 대해서는 프로그램의 성능과 구현의 복잡도에 대한 적절한 타협을 통해 결론지어야 할 것이다.