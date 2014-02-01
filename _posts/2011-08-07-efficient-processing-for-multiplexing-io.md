---
layout: post
title: 다중 입출력에 대한 효율적 처리
tags: async io -pub
---

다중 입출력 함수는 POSIX의 select 함수를 공부하면서 가장 많이 보게 되는 함수이다. 다중 입출력 함수라는 것은 영어로 바꿔보면 multiplex io function인데 말 그대로 여러 개의 io 를 하나의 함수로 처리한다는 것이다.

지난 글의 동기와 비동기에 이어서 여러 개의 io를 어떻게 처리하는 것이 효율적인지 알아보자.
[비동기 IO 함수]({% post_url 2011-08-07-asynchronous-io %})


지난 번에 봤던 함수들은 하나의 IO에 대해서만 사용 가능한 함수들이었다.
대표적으로 `scanf`는 stdin(표준 입력 스트림)으로부터 값을 읽어오도록 되어있고, `ReadFile`은 열려있는 하나의 File Handle 로부터 값을 읽는다. `WSARecv` 함수는 연결되어있는 하나의 Socket으로부터 데이터를 읽는다.

만약 채팅방을 만든다고 해보자. 채팅방에는 여러 사람이 접속해서 데이터를 주고 받는다. 따라서 n명의 사람이 연결되어있다면, 채팅 서버는 적어도 n개의 Socket과 데이터를 주고 받아야할 것이다. 어떻게 처리해야 좋을까?

### blocking + multi-threading ###

* 각 Socket 마다 처리하는 Thread를 따로 만든다. 왜냐하면 `Recv` 함수가 blocking이기 때문에, 이걸 단일 thread에서 처리할 경우 하나의 socket에서 데이터가 안 들어오면 다른 socket은 데이터가 들어오건 말건 읽을 수가 없기 때문이다.

```cpp
recv(hSocket1, lpBuffer, ...) // block !
recv(hSocket2, lpBuffer, ...)
recv(hSocket3, lpBuffer, ...)
```

따라서 각각의 Recv 수행은 다른 Recv 에 의해 방해받으면 안되기 때문에 여러 개의 thread 를 사용한다.

### non-blocking + single-threading ###

* `Recv` 함수를 non blocking으로 만든다. 그러면 하나의 thread로도 처리가 가능하다.

```cpp
for (int i = 0; i < socketCount; ++i) {
    if (nb_recv(hSocket[i], lpBuffer, ...) != -1) {
        // 데이터 처리
```

동기적으로 처리되지만 함수 수행은 non blocking이다. 코드 작성하기는 편하겠지만 매번 데이터가 있나없나 물어보는게 꽤나 고역이 될 것 같다. 특히 채팅 서버처럼 모든 사람이 대화를 하지 않을 때 아무 일도 하지 않아도 되는 서버라면 계속 입력이 있는지 검사하는 것은 쓸데없는 작업이 될 것이다.  
<span style="color: #888;">(그나마 게임 서버는 남는 시간에 AI 를 돌리는 등 로직이라도 수행하는데 말이다)</span>

### non-blocking + asynchronous ###

* non blocking에 asynchronous한 `Recv`를 사용해본다. 로직 작성하기는 어려워지지만 효율은 괜찮아진다.

```cpp
// 클라이언트 연결을 수락하는 함수
void accept_client () {
    // 클라이언트의 연결을 수락함.
    // 이로써 클라이언트와 통신 가능한 Socket 을 얻을 수 있다.
    HANDLE hSocket = Accept (...);
    // 연결 수락시 딱 한 번의 Recv 요청을 해둔다.
    async_recv(hSocket, lpBuffer, recv_callback);
}
// 클라이언트 데이터를 처리하는 callback
void recv_callback (char *lpBuffer) {
    // 받은 데이터 처리 코드 (생략)
    // 다시 Recv 요청, 이 때 hSocket 객체는 잘 관리해서 접근 가능해야한다.
    async_recv(hSocket, lpBuffer, recv_callback);
}
```

실제 thread가 어떻게 돌아가는지 상관 없이 깔끔하게 코드가 작성된다. 물론 비동기적으로 돌아가기 때문에 데이터 처리하는 코드 작성이 좀 더러워진다. 채팅프로그램을 가정할 경우 어떤 클라이언트로부터 받은 데이터를 다른 클라이언트들에게 보내주어야 하므로, 클라이언트 연결 목록이라는 공유 자원이 생긴다.

```cpp
// 클라이언트 연결을 수락하는 함수
void accept_client () {
    HANDLE hSocket = Accept (...);
    lock(&gClients);
    gClients.push_back(hSocket);
    unlock(&gClients);
}
void recv_callback (char *lpBuffer) {
    // 받은 데이터 처리 코드
    lock(&gClients);
    for (std::vector<SOCKET>::iterator it = gClients.begin();
        it != gClients.end(); ++it) {
            async_send(*it, lpBuffer, ...);
    }
    unlock(&gClients);
```

따라서 위의 코드를 보면 공유 자원인 `gClients`란 변수에 접근하기 위해 lock을 걸고 사용하는 것을 알 수 있다. 별로 효율상 좋아보이지 않는데 저 자료구조를 lock free하게 작성하는 것 말고는 딱히 좋은 방법도 떠오르지 않는다. (이 문제는 thread를 쓰던 non blocking io를 쓰던 모두 발생하는 문제다)

아무튼 저렇게 non blocking이면서 asynchronous로 작성할 경우 모든 연결에 대해 thread를 만드는 것보다, 그리고 모든 non blocking 연결에 대해 일일히 확인하는 것보다 효율은 좋을 것이다.  
(당연한 이야기이지만 asynchronous 로 작성하는 경우 non blocking 일 수밖에 없다.)

### multiplexing ###

* 다중 입출력 함수라고 불리는 select 함수를 사용한다. 이 함수는 여러 Socket에 대해 감시를 수행할 수 있고, 적절히 timeout 값을 지정해서 그 시간동안 IO가 없으면 반환해버리는 구조의 함수이다. 따라서 blocking, non blocking 양 쪽으로 모두 사용할 수 있다.
	* [http://kldp.org/node/112275](http://kldp.org/node/112275)
	* [http://www.joinc.co.kr/modules/moniwiki/wiki.php/Site/Network_Programing/Documents/select](http://www.joinc.co.kr/modules/moniwiki/wiki.php/Site/Network_Programing/Documents/select)
	* [http://www.joinc.co.kr/modules/moniwiki/wiki.php/man/2/select](http://www.joinc.co.kr/modules/moniwiki/wiki.php/man/2/select)

`select`는 이 글에서 다루기는 좀 애매하니까 넘어가자. 간략히 설명하면 여러 IO를 동시에 감시하고 그에 대해 통보 받을 수 있다는 것이다. 이는 asynchronous IO 함수를 쓰지 않고, non blocking IO들을 무의미하게 loop 돌면서 검사하지 않아도 어느정도 효율적으로 IO를 관리할 수 있고, 게다가 동기적으로(하나의 scope 내에서) 로직을 작성할 수 있으므로 코드를 작성하기도 편하다.  
동기적으로 작성되면 scope에 의해 context(변수 등)가 공유되고 실행 흐름을 파악하기 쉽기 때문에 문제가 발생할 확률이 적기 때문이다. 예를 들어 다음의 코드를 보자.

```cpp
while (select (...) != -1) {
    switch (ret) {
    case ACCEPT: clients.push_back (socket); break;
    case RECV:
        for (std::vector<SOCKET>::iterator it = clients.begin();
            it != clients.end(); ++it) {
            // 모종의 작업
        }
        break;
```

의사코드 수준이지만 위의 코드를 보면 accept를 수행하는 부분과 recv를 수행하는 부분이 하나의 흐름이다. 따라서 저 로직에서는 굳이 client들의 socket을 저장하는 자료구조가 전역일 필요도 없고 lock 또한 필요하지 않다. 게다가 파악하기도 힘든 thread수행 흐름에 의한 문제가 발생할 일도 없다.

### 어떤 것을 써야 할까? ###

IO 요청의 빈번성과 프로그램의 특성에 따라 위 서술한 것들 중 효율적인 것을 골라서 사용하면 된다.

* 공유되는 자원이 없고 IO 요청이 드문드문 일어나는 경우, 예를 들면 웹 서버 같은 경우이면 non blocking에 asynchronous IO를 사용하는 것이 효율적일 것이다. 웹 서버는 stateless하니까 각 연결마다 공유되어야하는 자료도 없고, 각 연결이 자주 있지도 않기 때문이다.

* 공유되는 자원도 많고 IO 요청도 잦은 경우라면 non blocking에 synchronous IO 모델을 사용하는 것이 효율적일 것이다. logic 코드와 IO 코드를 같은 문맥(context)에서 실행하면서 IO 역시 효율적으로 수행하기 때문이다. 그리고 공유되는 자원도 많기 때문에 asynchronous에 의한 callback 으로 작성하면 코드가 많이 복잡해질 것이고, 처리 순서 보장이 중요하기 때문에 왠만하면 동기적으로 처리하는게 안전하다.

하지만 이 가정들은 single thread 로 돌아간다고 가정할 때의 이야기이다.

### with multi-thread ###

multi thread 를 생각해보자.

* blocking IO를 사용하는 경우는 처음부터 multi thread 모델이었다. 5,000개의 연결이 이루어진다면 thread도 5,000개이다. 그러면 이걸 scheduling하는 CPU는 context switching 부담이 너무 커져서 효율이 좋을리가 없다.

* non blocking IO를 사용하는 경우 thread마다 감시해야하는 socket의 수를 나눈다. 즉 어디선가 load balancing을 해주어야하는데 그 과정 역시 부담이 되고 간단하지가 않다.

* asynchronous IO를 사용하는 경우는 thread고 뭐고 어차피 kernel에서 callback으로 불러주는거니까 해당 프로그램에서 돌고 있는 thread 중 적절한 것을 골라서 호출해 줄 것이다. 따라서 얘는 multi thread든 말든 그닥 직접 제어하는 thread랑 연관이 없어 보인다.

* select를 사용한다고 해도, select 하나가 감시할 수 있는 socket에는 한계가 있고, 게다가 그 개수가 많아지면 select의 처리 속도가 느려지기까지 한다. 역시 얘도 여러 thread에서 처리할 socket을 분리하고, 각 thread가 select로 처리해야한다는 것인데 2번과 동일한 문제가 발생한다.

<span style="color: #888">apache 웹 서버는 내부에서 select로 처리를 하다가 처리량이 많아지면 fork를 수행한다. 리눅스의 fork 자체는 그리 비싼 비용이 아니지만 어쨌든 부담이 있다. 물론 fork해서 process가 많아지기 때문에 전체적으로 apache군이 cpu scheduling 을 받을 확률은 증가하지만, 이 글에서 이야기할 건 아닌 것 같다.</font>

발상을 약간 전환해보자.  
multi core가 있는 환경에서 어떤 프로그램이 가장 빠르게 수행하기 위한 thread의 개수는 몇 개일까?
물론 반드시 한 프로그램만 수행된다는 보장이 없으므로 단언할 수 없고 수행 결과를 통해 tuning해봐야겠지만, 이상적으로 논한다면 core의 개수 만큼 thread를 갖으면 각 core마다 thread 1개씩 맡아서 수행해주니까 가장 빠를 것이다.

바꿔말하면, 다중 입출력을 수행하기 위해 thread를 여러 개 사용한다고 했을 때 입력 요청이 빈번하든 그렇지 않든 어차피 동시에 처리할 수 있는 thread의 개수는 core(processor)의 개수만큼이라는 것이다.

또한 위의 상황들을 비교해볼 때, 뭔가 IO 요청은 non blocking으로 요청하지만 완료 통지(completion notification)는 동기적(synchronous)으로 받아보고 싶다는 생각을 할 수 있다. 어찌보면 장점만 모으는 것인데, IO 함수가 다른 실행 흐름을 방해하지도 않으면서, 그 결과는 내가 직접 물어보고 처리하니까 처리 문맥도 보존이 되니 코딩하기도 편하다.  
그리고 이것들을 처리하는 thread 까지 core 개수에 맞춘다면? 그렇다면 그걸 효율적인 처리라고 할 수 있지 않을까.

그래서 나온게 IOCP(Input Output Completion Port)이다. 사실 얘가 하는 일은 크게 없는데,

* 운영체제 내부에 IO 요청을 쌓는 Queue를 만든다.
* 운영체제 내부에 IO 완료를 쌓는 Queue를 만든다.

정도로 이해하면 편하다.  
<span style="color: #888">(Windows Internals 나 Windows via C/C++ 을 보면 더 자세히 설명이 나오지만 이 글에서는 저정도로만 설명해보자. 어차피 IOCP 설명하는 글은 아니다.)</span>

* thread를 core개수만큼 만들었다. 그럼 이제 각 thread 는 IO 요청을 하고, 또한 각 요청이 완료되면 그 결과를 처리해야한다. 그리고 그것들은 **순서가 보장되어야 한다**.

* 각 thread들이 Send나 Recv등을 요청한다. 즉 IO 요청을 하면 각 요청들이 kernel 내부의 IO 요청 queue에 쌓인다. 그러면 kernel에서는 그 요청들을 하나씩 꺼내서 처리한다. 각 요청을 Queue에다가 넣어주기만 하기 때문에 Send나 Recv를 요청하는 함수는 **즉시 반환된다.(non blocking)**.

* kernel에서 그 요청이 완료되면, 완료되었다고 그것을 완료 queue에 넣는다. 그러면 각 thread는 `GetQueuedCompletionStatus`라는 함수를 통해 하나씩 꺼내서 확인한다. 그리고 IO 작업 완료를 **직접 확인했으니까** 그에 대한 처리를 진행한다. 이는 asynchronous IO 모델이 callback 함수를 언제 부를지 모르는 것에 비해, 직접 완료된 IO 가 있는지 확인하는 것이기 때문에 synchronous IO 모델이라고 할 수 있는 것이다.

즉, IO 의 요청은 모두 non blocking으로 진행되고, 각 요청이 완료되었는지를 직접 확인하여 처리하는 thread가 core의 개수만큼 있으므로 효율적으로 IO 를 처리할 수 있다는 것이다.  
<span style="color: #888;">(물론 언어 자체에서 thread를 효율적으로 관리해주고 하면 완전 asynchronous하게 동작하는 서버가 더 효율적일 수 있을 것 같다.)</span>

IO 프로그래밍을 할 때 요청과 완료 통지를 별개로 생각해보면 효율적 향상점을 찾을 수 있다. 물론 non blocking에 asynchronous한 모델이 더 생각하기도 어렵고 문제없이 작성하기도 어렵다.  
예를 들면, 상대와 메세지를 주거니 받거니 해야하는 경우 blocking이라면 주거니 받거니 하는 코드를 한 scope 내에서 작성하면 절차적으로 쓰고, 읽고, 쓰고, ... 순으로 수행이 되겠지만 non blocking이라면 그 요청이 끝날 때까지 기다려야하니 복잡해진다. 그래서 내부적으로 어디까지 받았는지 state로 관리해주던가 하는 부가적인 일을 더 해야하는 것이다.

### 마무리 ###

글 자체에서 IOCP 와 select 에 대해 거의 다루지 않고, 요청과 완료 통지의 분리에 대해서만 급하게 설명하다보니 제대로 그 의도가 전달되었는가 모르겠다. 최근에 봤던 어떤 글에서 IO 함수의 blocking과 non blocking, 그리고 그것을 처리하는 방식의 synchronous, asynchronous에 대해서 혼동하고 있기에 이전 글과 이번 글로 그 개념을 구분하는데 어느 정도 도움이 되었기를 바라면서 썼는데, 쓰다보니 내용이 별로인 것 같다 [...]

빠른 서버를 구성함에 있어 각 서버의 특성상 알맞는 모델을 채택하는 경우가 있으니까 IOCP까지는 공부를 해두면 좋다. 그래야 apache나 다른 웹 서버가 어떤 차이에 의해서 왜 빠른지 이해하는데 도움이 될 수 있다고 생각하기 때문이다.