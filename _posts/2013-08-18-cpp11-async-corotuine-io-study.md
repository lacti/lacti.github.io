---
layout: post
title: c++11 async, corotuine, io 스터디
tags: async io study -pub
---

오늘 스터디에서 공부한 내용을 간단히 정리해보자.

### async, future ###

* [future, promise](http://en.cppreference.com/w/cpp/thread/future)는 비동기로 실행되는 수행 결과를 받아오기 위한 개념이다.
* [`async`](http://en.cppreference.com/w/cpp/thread/async)는 내부적으로 `promise`를 사용하여 결과를 `set()`할 비동기 작업을 수행시키고, future를 반환한다.
* [`packaged_task`](http://en.cppreference.com/w/cpp/thread/packaged_task)는 비동기 작업을 수행할 수 있는 task 객체를 만들어준다. task 객체로부터 future를 가져올 수 있다.
* vs2012 기준으로 내부 구현 분석한 내용: [async, future, promise in c++](http://www.slideshare.net/lactrious/synchronizing-concurrent-threads)

vs2012 쪽 문제인지 `std::async`를 수행할 때 `std::launch `enum 값을 주지 않으면 `std::launch::any`로 수행하게 되는데 이 때 `deferred`로 수행되면서 `future`를 통해 값을 가져오게 될 경우 문제가 발생하는 것 같다. 내가 개념을 잘못 이해하고 있는 것인지 모르겠는데 문제가 발생하지 않으려면 `std::launch::async`로 policy를 주고 실행해야 할 듯

* [Stackoverflow: VS11 with std::future - is this a bug?](http://stackoverflow.com/questions/9389409/vs-11-with-stdfuture-is-this-a-bug)


### spawn ###

* [Wiki: Cilk](http://en.wikipedia.org/wiki/Cilk)
* fork/join
	* [minjang: 왜 fork, join이라는 이름일까?](http://minjang.egloos.com/834885)
	* [Java: Fork/Join](http://docs.oracle.com/javase/tutorial/essential/concurrency/forkjoin.html)

상호 의존관계가 없는 작업 집합을 실행할 때, 작업 구간을 여러 개로 나누고(partitioning), 해당 작업을 수행할 작업자(thread)를 만들어서(spawn/fork) 동시에 작업이 수행되도록 한다. 그리고 모든 작업자의 작업이 완료될 때까지 기다려서(join) 그 결과를 하나로 합친다.

### c# async/await ###

비동기 작업을 위해 작업을 수행할 Task를 만든다. 해당 Task가 완료되면 다음 작업을 수행할 수 있도록 Task를 엮는다(Task Continuation)

* [MSDN: Task Parallel Library](http://msdn.microsoft.com/en-us/library/dd460717.aspx)

특정 Task의 결과를 획득할 수 있을 때까지 대기한다. 이 때 할 수 있는 다른 일이 있다면 찾아본다(await). 이는 단순히 compiler가 await하는 코드들을 하나의 state machine으로 묶어서 state를 변화시키면서 해당 함수를 계속 불러주는 방식으로 만들어주는 것이다.

* [Dixin: Understanding C# async / await Compliation](http://weblogs.asp.net/dixin/archive/2012/11/02/understanding-c-async-await-1-compilation.aspx)

실제 코드가 각각 어떤 thread에서 수행될 수 있는지에 대해서는 약간 복잡할 수 있는데 이에 대해서는 다루지 않았다. 요약하면, 비동기 logic을 동기적으로 작성하기 위한 async/await는 결과적으로 state machine code로 compiler에 의해 변환되어 .net thread-pool에 들어갔다 나왔다하면서 코드가 수행된다는 것.

아래와 같이 코드가 작성되면 연결되는 모든 connection에 대해서 결과를 console에 출력해줄 수 있다.

```csharp
async void Listen() {
    var serverSocket = new Socket(...);
    Socket clientSocket;
    while ((clientSocket = await serverSocket.AcceptAsync()) != null)
        ProcessSocket(clientSocket);
}
async void ProcessSocket(Socket clientSocket) {
    string line;
    while ((line = await clientSocket.ReadLineAsync()) != null)
        await Console.WriteLineAsync(line);
}
```

약간 설명을 추가하면,

* `serverSocket.AcceptAsync()` 함수를 await할 때 Listen StateMachine이 accept completion state를 대기.
* accept에 성공한 후 ProcessSocket StateMachine이 read line completion state를 대기.
* 그런데 Listen StateMachine과 ProcessSocket StateMachine은 await하는 관계가 없으므로 서로 다른 Task가 되어 동시에 `Accept`도 하고 `ReadLine`도 할 수 있는 것이다. (즉 작업 흐름 단위가 아니라 Task 단위)


###  coroutine ###

* [Wiki: Coroutine](http://en.wikipedia.org/wiki/Coroutine)
* [Wiki: Generator](http://en.wikipedia.org/wiki/Generator_%28computer_science%29)
* [UnityStudy: Coroutine의 기본 개념 및 활용](http://www.unitystudy.net/bbs/board.php?bo_table=writings&wr_id=43)

> allow multiple entry points for suspending and resuming execution at certain locations

정의 자체가 위와 같기 때문에 가장 낮은 수준에서 생각해보면 cpu context를 마음대로 치환할 수 있으면 coroutine을 쉽게 만들 수 있겠다! (user mode context switching)  
boost는 boost context를 먼저 만들어서 cpu context를 capture할 수 있게 한 다음 그것을 사용해서 boost coroutine을 만들었다.

그런데 그런 구현 방법 뿐만 아니라 generator를 이용해서 대충 coroutine처럼 사용할 수 있도록 할 수도 있다. c#의 yield return이 그런 형태인데, 이건 그냥 compiler가 해당 코드를 state machine으로 만들어서 다시 부르면 다음 코드부터 이어서 실행될 수 있도록 만들어 주는 것.

```csharp
IEnumerable<int> MyGenerator() {
    /* do something 1 */
    yield return /* first value */;
    /* do something 2 */
    yield return /* second value */;
    /* do something 3 */
    yield return /* third value */;
    /* do something 4 */
    yield return /* forth value */;
}
```

위와 같이 yield 코드를 작성하면 compiler가 아래와 같이 코드를 만들어준다.

```csharp
struct MyGeneratorStateMachine {
    public int Current { get; set; }
    public bool MoveNext() {
        switch (_state) {
        case 0: /* do something 1 */ Current = /* first value */; _state = 1; return true;
        case 1: /* do something 2 */ Current = /* second value */; _state = 2; return true;
        case 2: /* do something 3 */ Current = /* third value */; _state = 3; return true;
        case 3: /* do something 4 */ Current = /* forth value */; _state = -1; return false;
        }
        return false;
    }
```

그러면 함수 호출자에서는 `MyGeneratorStateMachine` 객체를 만들어서 `MoveNext()`가 false일 때까지 불러가며 `Current` 값을 접근하면 되는 것이다. gb님께서 이야기하셨던 것 중 python의 `range`, `xrange`의 차이를 보는 것도 도움이 될 듯. (lazy evaluation)

개인적으로는 user mode context switching 지지자인데 그게 구현되었다면 c#에서도 async/await같은 trick을 쓰지 않고 진정 막장 구현이 가능했을 것이라고 본다...만 .net에서는 지원할 생각이 없는 것 같다.

### io ###

`user -> kernel (kernel + device driver) -> physical -> kernel -> user`로 이어지는 장대한 여행

* [Warriors of the Net](http://www.youtube.com/watch?v=PBWhzz_Gn10)

약간 거리가 있지만

* [비동기 IO 함수]({% post_url 2011-08-07-asynchronous-io %})
* [IO와 메모리 복사]({% post_url 2011-08-14-io-and-memory-copy %})

어쨌든 io는 request 과정과 completion을 처리하는 과정 두 개로 나누어 생각해볼 수 있다. 하나의 io 함수가 두 개를 모두 처리한다면 (보통은) blocking function이 될 것이고, 이 둘을 나누어서 처리한다면 non-blocing function이 될 것이다.

예를 들어 아래와 같은 코드는 blocking function을 사용한 동기적 코드이다.

```cpp
ret sync_io(...) {
    request(...);
    wait_for_completion(infinite);
    return result_from_completion();
}
```

아래와 같은 코드는 non-blocking function과 callback을 사용한 비동기적 코드이다.

```cpp
void async_io_req_callback(...) {
    register_callback();
    request(...);
}
ret async_io_callback(...) {
    return result_from_completion();
}
```

아래와 같은 코드는 non-blocking function을 사용하면서 그 completion에 대한 queue롤 통해 명시적으로 그 결과를 처리하는 코드이다.

```cpp
void async_io_req_completion_queue(...) {
    request(...);
}
void worker_loop() {
    while (true) {
        var completion = dequeue_completion_from_queue();
        // process completion
    }
}
```

정리하면,

* async io 방식은 callback을 등록해서 완료 시 callback이 호출되는 방식과,
* io가 완료된 시점에 completion이 어떤 queue에 들어가면, 그 queue로부터 하나씩 직접 꺼내서 처리하는 방법이 있다.

callback에 의한 io는 해당 callback이 언제 불러줄지 모른다. 때문에 callback이 불렸을 때 공유 자원을 보호해주는 방법도 좀 까다롭고 코드를 읽기도 쉽지 않다. 하지만 library 제작자 입장에서는 scheduling이 편하다는 장점이 있다.

completion queue를 사용하는 방법(iocp)은 직접 thread-loop를 작성하여 명시적으로 completion을 처리할 수 있다는 점에서 callback보다는 실행 흐름 제어가 조금 편하다(?)는 장점이 있다고 할 수 있다. 그렇지만 코드를 읽는 측면에서는 callback에 비해서 request와 completion의 거리가 더 멀리 떨어지기 때문에 더 좋지 않을 수도 있다.

### reactor & proactor ###

async io를 논할 때 reactor와 proactor 개념이 나온다.

* reactor는 io의 장치가 준비(ready)된 상태를 감지하여 알려주는 것이고,
* proactor는 io 요청을 받아서 처리해주고 그 결과(completion)를 비동기로 알려준다는 것이다.

대표적으로 epoll()를 써서 reactor를 구현된 모델을 생각해보거나, proactor 패턴으로 구현된 IOCP를 생각해보면 되겠다.

### asio ###

asio는 boost library로 async io를 cross-platform으로 사용할 수 있게 해주는 좋은 library이다. 크고 아름다운 ace framework과 비교되어 쓰기 좋다는 평을 받고 있다.

asio는 proactor pattern으로 구현된 것인데, windows에서는 iocp를 쓰니까 그냥 wrapping만 하면 되고, linux에서는 epoll()을 잘 감싸서 proactor pattern을 user mode에서 구현한 것으로 알고 있다. 요약하면 비동기를 요청하고, completion을 callback으로 받아서 처리한다는 것.

asio 코딩을 통해 async request/completion의 개념을 이해하면 좋을 것 같아 넣어봤다. 자세한 내용은 asio document이 워낙 잘 되어 있으니 그 쪽을 보면 좋다.

* [Boost.Asio](http://www.boost.org/doc/libs/release/doc/html/boost_asio.html)

### [IOCP](http://msdn.microsoft.com/en-us/library/windows/desktop/aa365198.aspx): ~~Windows의 자랑~~ ###

request와 completion을 분리한 비동기 io 함수와 분리된 두 문맥을 연결해주기 위해 준비되는 overlapped 구조체는 iocp 이전부터 존재했던 windows api이다(apc 포함). 다만 callback이 불리는 시점도 애매하고 흐름이 눈에 잘 띄지 않으니 completion queue를 api로 노출시켜 접근할 수 있게 만들어준 것.

요약하면,

1. *[user]* completion port를 만든다.
2. *[user]* completion port에 io device handle을 (socket 등) 연결(mapping)한다.
3. *[user]* 해당 handle에 대해 비동기 io 요청을 한다.
4. *[user]* thread를 만들어서 completion port에 대기시킨다. (`GetQueuedCompletionStatus`)
5. *[kernel]* 해당 io 요청이 완료되면 completion port에 completion을 넣어준다.
6. *[user]* completion port에 대기 중인 thread 중 하나가 깨어나서 해당 completion을 처리한다.

수행 흐름을 명시적으로 관리할 수 있다는 점,
그리고 completion port에 대기 중인 thread를 kernel이 잘 관리하여 적절한 녀석(대충 LIFO 방식)을 깨워서 작업을 시킨다는 점이 iocp의 장점이라 하겠다.

뭐, kernel이 io 작업 다 해주고 user는 completion만 처리하면 되니 다른 일에 집중할 수 있어 더 좋은건 당연한 소리

### [RIO](http://www.serverframework.com/asynchronousevents/2011/10/windows-8-registered-io-networking-extensions.html) ###

iocp를 만들고 열심히 profiling을 해보니 3가지 문제가 있댄다.

1. async io 요청할 때 전달되는 memory를 non-paged-pool에 넣기 위해 lock거는 비용
2. `GetQueuedCompletionStatus()` 함수 등의 api를 부를 때 kernel mode switching 비용
3. request/completion 마다 device handle에 mapping된 completion port handle을 찾는 비용(handle table lookup)

1번의 경우는 zero-byte receive 기법으로 대충 우회가 된다. locked page가 뭔 소리인지는 대충 다음 링크에서 보자. [IO와 메모리 복사]({% post_url 2011-08-14-io-and-memory-copy %})

rio는 각 문제를 다음과 같이 해결했다.

1. 프로그램 시작 시 미리 buffer를 만들고 lock을 잡아놓고 쓰자. 그러면 그 이후 요청할 때에는 이미 lock된 memory를 쓰니까 매 요청마다 lock을 걸 필요가 없으니 비용문제 해결
2. request/completion queue를 user mode에 노출시켜 user mode에 존재하는 queue만 보고도 작업이 될 수 있도록 한다. 그런데 user mode로 노출된 queue는 thread-safe하게 보호해주지 않으니 알아서 잘 보호해서 써라. (그런데 이 queue들이 어떻게 kernel 자료구조와 mapping되는지는 아직 잘 모르겠음-_-)
3. iocp는 device handle로 요청하고 completion port로 completion이 와야하기 때문에 handle lookup이 일어나는데, rio에서는 이걸 미리 queue를 각자 다 따로 만들어서 연결해두기 때문에 handle lookup 과정이 없다는 것

* [MSDN: What's New for Windows Sockets](http://msdn.microsoft.com/en-us/library/windows/desktop/ms740642.aspx)
* [Channel9: New techniques to develop low-latency network apps](http://channel9.msdn.com/Events/Build/BUILD2011/SAC-593T)

사실 성능에 좀 의문이 있기는 했는데, 이걸로 실험해본 사람이 iocp보다 30~40% 성능 향상을 경험했다고 한다. 좀 미묘한 설계이기는 했는데 나중에 기회가 되면 글 쓰겠음.

### 마무리 ###

병렬성과 비동기는 연관성이 있는 내용이라고 생각했기 때문에 위와 같은 keyword를 던저보았다. 그나마 친숙한 비동기 함수는 비동기 io라서 주제로 잡은 것도 있지만, 다음 주제가 distributed system이니 적어도 network programming은 알아야 한다고 생각해서 밀어붙였던 것도 있다.