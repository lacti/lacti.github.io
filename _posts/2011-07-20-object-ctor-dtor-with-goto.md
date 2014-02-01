---
layout: post
title: 객체의 생성, 소멸과 goto 이야기
tags: c++ -pub
---

### 생성자 소멸자 이야기 ###

어떤 class의 생성자와 소멸자를 구현했다. 거기에서는 엄청나게 복잡한 작업을 수행한다. 예를 들면,

```cpp
class Object
{
public:
    Object (void) { /* 엄청 복잡한 작업 */ }
    ~Object (void) { /* 진짜 복잡한 작업 */ }
    Object (const Object& other) { /* 적절한 복사 생성자 */ }
    Object& operator = (const Object& other) { /* 신통한 대입 연산자 */ }
};
```

그리고 저 객체를 다음과 같이 사용한다고 해보자.

```cpp
std::vector<Object> objects;
for (int i = 0; i < 1000; ++i)
    objects.push_back (objectFactory.create(i));
```

무엇이 문제일까?  
복사 생성자와 대입 연산자가 적절하게 잘 구현되어있다고 하자. 그러면 sallow copy 문제는 당연히 아니다.

문제는 `vector` 자체가 `Object`로 구현되어 있기 때문에 내부에 `Object`에 대한 배열을 갖고 있을 것이며, `push_back`을 수행할 때마다 내부의 배열 공간이 할당되면서 `Object`의 생성자에서 무시무시한 작업을 수행할 것이며, 수행된 이후에 대입 연산자를 통해 Object 객체가 복사될 것이다.
(물론 `vector`의 `push_back`은 넣을 때마다 늘어나지는 않고, 2배인가 √2배인가로 늘어났던 것 같다)

또한 저 `vector`가 소멸될 때 내부 `Object`배열의 소멸자가 단체로 호출된다면 ㅎㄷㄷ

가끔 이런 코드를 작성하는 사람도 있다.

```cpp
while (running)
{
    std::vector<Object> objects;
    if (objectManager.flush (objects))
        std::for_each (objects.begin (), objects.end (), ObjectFunctor ());
}
```

심지어 이 구문에서는 `std::vector` 객체를, 그것도 `Object`라는 무시무시한 객체에 대한 `vector` 객체를 매 { } 마다 생성, 소멸을 반복한다. 즉 while 의 { 에서 vector 의 생성자가 호출되고, } 에서 `vector` 의 소멸자가 호출되는 것이다.

즉, 위의 코드를 다시 대충 표현해보면,

```cpp
while (running)
{
    std::vector<Object> objects;
    // objects::vector<Object>();  생성자 호출
    if (objectManager.flush (objects))
        std::for_each (objects.begin (), objects.end (), ObjectFunctor ());
    // objects::~vector<Object>();  소멸자 호출
} // while loop
```

이게 얼마나 프로그램에 부담이 될지는 자명한 일.  
*(추후 수정하면 위 내용에는 좀 오해가 있었고, 실제 vector의 생성 시에는 별로 하는 일이 없으므로 `vector` 생성마다 부담이 되는 건 없다)*

### goto 이야기 ###

옛날에는 error 처리를 위해 goto가 추천되던 시절이 있었다. 오해 말자. C 언어 시절이다.  
그 이유는 function 내에 탈출 흐름 구문(return)이 너무 많아지면 에러 처리 등이 힘들기 때문에 에러를 처리하기 위해 goto 를 쓴다는 것이다.

```cpp
int socket_accept (socket_t** server, socket_t** client)
{
    if (NULL == (*server = serversocket_create ())) goto error_out;
    if (NULL == (*client = clientsocket_create ())) goto error_out;
    if (-1 == socket_listen (*server)) goto error_out;
    if (-1 == socket_accpet (*server, client)) goto error_out;
    if (-1 == socket_handshake (*client)) goto error_out
    return 0;
error_out:
    if (NULL != *client) socket_close (*client);
    if (NULL != *server) socket_close (*server);
    return -1;
}
```

만약 위의 코드를 에러 확인 후 자원 해제 및 에러를 반환하게 했다면, 꽤나 많은 검사와 해제 중복 코드가 생겼을 것이다. 그렇기 때문에 에러 발생 시 할당한 자원을 모두 해제하고 에러 코드를 반환하기 위한 구문을 하단에 모아놓고, 에러 발생 시 그 쪽으로 goto를 시킨다는게 주 발상이었던 것이다.

C++에 와서 저런 문제가 없어졌을까?  
없어지지는 않았지만 설계적 접근으로 해결할 수 있다. java 같은 경우는 ~~(많이 욕먹은 이유 중 하나이지만)~~ checked exception을 사용해서 logic 과 exception 을 깔끔하게 분리할 수 있게 해주기도 하였다. ~~(물론 쓰기에 따라 안 깔끔할 수도 있지만)~~

재밌는건, 저러한 코드를 C++에서 작성했다면, 옛날 컴파일러에서 문제가 발생할 여지가 있다는 것이다.
Object 예제로 확인해보자.

```cpp
    std::vector<Object> objects;
    // objects::vector<Object>(); 생성자 호출
    if (objectManager.flush (objects))
        std::for_each (objects.begin (), objects.end (), ObjectFunctor ());
    else goto error_out; // flush 에 실패했다면 error out!
    // objects::~vector<Object>(); 소멸자 호출
    return true;
error_out:
    // 모종의 에러 처리 작업
    return false;
```

한 눈에 알 수 있다. goto에 의해 객체의 소멸자 호출 구문을 멋지게 뛰어넘어버린다. 만약 Object 생성자에서 동적으로 할당한 메모리를 소멸자에서 해제하는 코드가 있다면, goto에 의해 메모리가 줄줄 새게 된다는 것이다.

이러한 문제가 가장 심하게 발생했던 곳은 SEH (structured exception handler) 이다. 객체를 가지고 어떤 일을 수행하다가 예외가 발생하면? try catch 구문을 만날 때까지 stack 이 주욱 감겨(rewinding) 올라가는데 이 과정에서 객체의 소멸자를 안 불렀다는 "이야기"가 있다. 물론 나는 당해본 적이 없어서 모르겠지만 -_-

```cpp
{
    Object object;
    // object::Object(); Object의 생성자는 호출이 된다.
    throw std::string("memory leak!"); // Stack은 감아주지만 소멸자는 호출이 안된다.
    // object::~Object(); 소멸자는 누가 불러주나?
}
```

그렇다면 이걸 해결하기 위한 방법으로는 어떤 것이 있을까? 재미있게도, `do, while(0)` 문으로 해결이 된다.

```cpp
do
{
    std::vector<Object> objects;
    // objects::vector<Object>(); 생성자 호출
    if (objectManager.flush (objects))
        std::for_each (objects.begin (), objects.end (), ObjectFunctor ());
    else break; // flush 에 실패했다면 에러 처리를 하자
    return true;
    // objects::~vector<Object>(); 소멸자 호출
} while (0);
// 모종의 에러 처리 작업
return false;
```

`do while(0)` 는 어차피 한 번 실행되고 종료되는 구문이다. 다만 scope 만 하나 만들어 줄 수 있으며, 그냥 { } 보다 좋은건 `while (0)` 뒤에 ; 이 붙을 수 있기 때문에 과거 C에서 매크로 함수로 많이 썼던 방법이었다.

하지만 더 좋은 것은 `break` 구문이 먹는다는 것이고, `break` 구문은 `do while`의 scope를 벗어나는 지점으로 이동하기 때문에 objects 의 소멸자가 호출될 수 있다는 것이다.

위의 코드를 보면 정상 경로에서 } 가 닫히기 직전인 objects의 소멸자 호출이 return보다 나중에 되어서 해제가 안되는 것 아니냐고 할 수 있겠지만, 옛날 컴파일러는 다행히 그정도로 멍청하지 않아서 소멸자를 불러주고 return을 수행해준다. 고로 모두 행복하다.

재미있는 것은, *visual studio 2010으로 goto로 탈출 했을 경우 객체의 소멸자가 불리지 않는가!* 에 대해 실험을 해봤는데, 이 신통한 컴파일러가 goto 구문 앞에다가 소멸자를 부르는 코드를 추가해놨다-_-

```cpp
    {
        Object object (rand());
        object.PrintStatus();
        if (object.GetStatus() > 10)
        {
            // object::~object();
            goto error_out;
        }
        object.OnComplete();
        // object::~object();
    }
    return 0;
error_out:
    return -1;
```

뭐, 어쨌든 코드의 흐름이 이리 뛰고 저리 뛰고를 자주 하면 짜기도, 읽기도, 고치기도 힘들어진다. 그럼 결국 오묘한 버그가 탄생하고 야근을 하게 되겠지!