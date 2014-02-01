---
layout: post
title: context switching과 simultaneously 실행
tags: concurrency -pub
---

multi thread (or process) programming에서 가장 기초적인 개념으로 ABA Problem과 연결(되나?) 되는 기본적인 개념을 설명하고자 한다. **한 개의 코어는 한 시점에 한 개의 명령을 수행한다!** 라는 기본 전제를 깔고 이야기를 시작해보려 한다.

### context switching ###

태초 단일 코어(core) 시대에는 한 개의 프로그램만 실행하면 됬다. 그게 OS든 그냥 프로그램이든. 여러 개의 프로그램을 동시에? 그런 사치 따위 없다. 그냥 하나라도 빨리 수행하면 그만.

그러다가 cpu가 발달하고 느린 작업, 빠른 작업, 사용자 반응성(interact)이 중요한 작업, 그렇지 않은 작업 들에 대해서 분리해서 한 번 같이 실행해볼까 하는 시도가 나왔다. (물론 처음에는 묶어서batch 작업을 처리했던가)  
그래서 출력하면서 문서 편집을 할 수 있다는, ABABABABABAB를 빨리해서 A와 B가 동시에 실행되는 것 처럼 보이는 좋은 구조가 나타났다.

그렇게 여러 개의 프로세스(프로그램이 실행되고 있는 것)가 짧은 간격으로 번갈아가며 수행하니 동시에 실행되는 것 같아 참으로 보기 좋았다. 그런데 문제는 메모리 공간이 모자르기 시작했다. 그래서 각 프로세스 별로 [메모리 공간을 가상화](http://en.wikipedia.org/wiki/Virtual_memory)해주고, 그것들을 실제 메모리에 연결해주는 메모리 매핑을 운영체제가 지원해주었다.

이제 운영체제는 CPU를 제어하여 여러 프로세스들을 번갈아가며 빠르게 실행해주고, 메모리를 관리하여 부족한 공간은 디스크에 적당히 연결해서 사용(swap memory)할 수 있게 해주었다.

물론 각 프로세스는 자신의 수행이 중단되고 다른 프로세스가 작업을 재개(context switching) 하는지, 자신이 사용하는 메모리가 물리 메모리(physical memory)에 있는지 이게 아니면 swap out되어서 disk 에 있는지 몰라도 크게 상관이 없었다.

메모리 이야기는 다른 곳에서 또 하겠지만, 어쨌든 이 글의 주제인 CPU scheduling만 본다면, 하나의 core는 결국 한 순간에 하나의 명령만 수행할 수 있고 여러 프로세스를 돌아가면서 수행해봐야 엄밀히 따지면 그 프로세스들이 동시(simultaneously)에 실행된다고 볼 수는 없다는 것이다.

<span style="color: #888;">간단히 말하자면, 내가 만든 프로그램을 CPU 가 실행 중인 바로 그 때는 운영체제 코드가 실행될 수 없다, 컴퓨터는 지금 실행하는 코드가 무슨 코드인지 관심 없고 그냥 program counter가 가리키는 기계어를 읽어서 처리할 뿐이다. 지금 수행하고 있는 프로세스를 제치고 운영체제 코드가 수행되려면 interrupt 가 일어나야한다(preempt). 물론 실행 가능한 명령과 그렇지 않은 명령에 대한 권한은 그 기계어가 있는 메모리 영역에 대한 segment의 특성attribute 으로 설정가능하다.</span>

### multi thread programming ###

각 프로세스들은 자신의 실행 흐름을 갖는다. multi thread라는 개념이 없을 때, 각 프로세스는 단 한 개의 주 실행흐름(main thread)를 가지고, 이것이 cpu에 의해서 실행되었다.

cpu에서 실행하기 위해 필요한 정보들, 즉 실행 문맥(state, context)은 register 등을 생각해보면 되겠다. 어차피 현재 CPU가 수행하고 있는 정보들은 PC(IR), EA...DX, ESI, EDI, EBP, ESP 등(x86) 다 register에 저장되어있으니까 이 값만 잘 저장했다가, 나중에 복구해주면 거기서 이어서 작업을 수행할 수 있을 것이다. 즉 여러 실행 흐름을 번갈아가면서 실행한다는 것은, 각 실행 흐름(thread)의 문맥(context)을 저장해놨다가, 그걸 번갈아가며 register에 덮어쓰고 그 지점(PC)의 코드를 이어서 실행시키게 한다는 것이다. [context switch](http://en.wikipedia.org/wiki/Context_switch)

그러면, 굳이 하나의 프로세스마다 하나의 실행 흐름만 있을 필요가 있나? 그래서 하나의 프로세스가 여러 실행 흐름(thread)을 갖는 multi thread programming이 나오게 됬다(억지다!)  
즉, 내부에서 메모리는 공유(static, heap 영역)하지만 cpu scheduling은 따로 되어서 실행 흐름은 서로 영향을 안 주는 것이라고 볼 수 있다.

억지 예제를 들자면, 테트리스를 짠다고 할 때, 키 입력을 blocking io 함수인 scanf 로 받는다고 하면, enter key를 눌러서 stream을 flush 하기 전까지 프로그램 수행은 멈춘다. 이를 위해서 키 입력을 받는 thread와 게임 logic을 돌리는 thread 를 분리할 수 있을 것이다.
(물론 테트리스를 만든다면 `GetAsyncKeyboardState` 같은 non blocking 함수를 쓰는게 나을 것 같다)

아무튼, 이렇게 하나의 프로세스에서 여러 스레드가 수행된다면, core는 그 thread들의 수행을 중간에 끊어서 다른 thread 로 전환(context switching) 할 수 있기 때문에 프로그램을 짤 때 각별히 주의해야한다.

왜냐하면 C++ 코드의 한 줄은 기계어가 한 번에 실행할 수 있는 하나의 명령, 즉 1:1 관계가 아니기 때문에 그 명령 내부에서 context switching이 발생하면 문제가 생길 수 있기 때문이다.

물론 lock을 사용하여 배타적 구간을 만드는 방식으로 프로그램을 작성한다고 해도 이러한 thread 간에서 서로 lock을 획득하다 발생할 수 있는 dead (or live) lock 문제가 발생할 수도 있다.  
따라서 multi thread programming 을 할 때는 이러한 문제까지 고려하여 더욱 세심하게 프로그래밍을 해야한다. [ABA Problem](http://en.wikipedia.org/wiki/ABA_problem)

### simultaneously ###

위의 개념은 엄밀히 동시에 실행된다고 할 수 없다. 하나의 core가 context switching을 하면서 수행해주는 것이기 때문에 하나가 수행하고 있으면 다른 하나는 멈춰있는 상태라는 것이니까.

하지만 시간은 흐르고 multi-core 시대가 되었다. 이제 ABABABAB 시대는 막을 내리고 AAAA와 BBBB가 문자 그대로 동시(simultaneously)에 실행되는 시대가 온 것이다.

한 thread에서 context switching이 일어날 때와 여러 core에서 여러 thread가 동시에 수행될 때 발생하는 문제는 대동소이하다. 다만 차이가 있다면,

* lock을 사용할 때, 단일 core의 경우 어떤 프로세스가 lock을 획득하지 못할 경우 그냥 해당 lock의 wait queue에 들어가서 scheduling 대상에서 빠지는 것이 더 효율적일 수 있다. 왜냐하면 spin lock처럼 cpu를 소모하면서 기다려봤자 자신의 수행이 다른 thread로 switching되기 전에는 lock을 획득할 일이 없기 때문이다.  
  
  multi core에서 동시에 실행된다면, spin lock으로 기다리는게 유리하다. 물론 lock 구간이 길지 않을 때이다. 한 core에서 실행 중인 thread가 lock을 획득하기 위해 spin하고 있으면, 다른 core에서 수행 중인 lock을 얻은 thread가 그 구간을 수행하고 unlock을 하면 spin하던 thread가 바로 그 구간을 실행할 수 있기 때문이다.  
번거롭게 커널의 lock wait queue에 들어가서 sleep했다가 다시 wake up해주는 무거운 방법(semaphore)을 쓸 필요가 없다

* 연산에 대한 lock operation을 수행할 때 단일 core의 수행만 보호해주는 것이 아니라 다른 core까지도 보호를 해주어야 한다. 예를 들어 다음의 명령이 있다.

```cpp
mov eax, dword ptr [count]
add eax, 1
mov dword ptr [count], eax
```

이 명령을 단일 core에서 수행한다면 저 명령 3줄을 실행하는 동안 context switching을 못하게 하면 그만이다. 하지만 여러 core에서 수행된다면 thread A가 `add eax, 1`을 수행하는 와중에 thread B가 mov `eax, dword ptr [count]`를 수행해버릴 수 있다.
뭐 spin lock 등을 걸어서 저 명령어 수행의 배타성을 보장해줘도 되지만 그건 너무 비싸다. 그래서 하드웨어 설계하시는 아저씨들이 열심히 고민을 해서 lock operation이라는걸 만들었다.

왜냐하면 cpu는 자신이 수행해야할 명령어를 instruction cache에 넣어두고 수행을 하게 되는데, thread A의 저 3줄이 다 끝나기 전에 thread B를 수행하는 core의 instruction cache에 저 명령이 들어가면 안된다. 하지만 그걸 cpu 가 알 수 있나? 그냥 thread A에서 저 명령을 수행할 때 lock operation이면 다른 cpu의 instruction cache를 비워버릴 수 밖에. 그래서 내부적으로 lock operation을 사용하는 interlocked operation 함수들이 비싸다는 거다.  
(하지만 뭐 다른 뾰족한 수가 없다, single core 에서는 context switching 을 유발하는 timer interrupt 를 강제로 막아버려서 thread-safe 하게 수행을 이어나가는 방법도 있지만-_-)

물론 multi core에서도 하나의 core가 여러 thread를 수행하게 되면 내부에서 context switching이 발생한다. 코드가 동시에 실행될 수도 있고, 실행 문맥이 전환될 수도 있는 것이다.

결론은 이러한 프로그래밍을 더 이상 피할 수 없는 시대에 왔으며-_- (그래서 과목도 생긴지 좀 되었다!)  이에 대해 잘 공부하여 이로 인해 발생할 수 있는 문제를 잘 회피하자는 것이다. 편하다고 single thread만 고려해서 작성하다 보면 나중에 나처럼 망한다.