---
layout: post
title: volatile과 interlocked operation
tags: concurrency c++ -pub
---

### volatile ###

다음과 같은 코드가 있다.

```cpp
// 공유되는 변수, static 이라든지 member 변수라든지 전역변수라든지
int count = 0;
++count;
++count;
++count;
```

세 번의 ++ 연산을 모두 a 라는 변수에 수행하므로, 컴파일러는 최적화를 통해 다음과 같은 코드를 만들어낼 수 있다.

```cpp
mov eax, dword ptr [count]
add eax, 1
add eax, 1
add eax, 1
mov dword ptr [count], eax
```

만약 multi-thread 환경에서 저 코드가 여러 thread에 의해 수행된다고 하면, `add eax`를 수행하고 `mov dword ptr [count], eax`를 수행하기 전에 switching이 되면, 다른 코드에서는 아직 count 연산이 반영되지 않은 연산을 수행하게 될 것이다.

즉, thread 1에서는 아직 연산결과가 eax에서 count로 반영이 안 되었는데, thread 2에서는 count로부터 값을 읽어서 연산을 수행해버리므로 계산 결과가 안드로메다로 간다는 것.

이럴 때 `volatile` 키워드를 사용한다. `volatile` 키워드를 붙이면 해당 변수의 값을 다른 무언가가 바꿀 수 있다는 의미, 즉 값이 보장되지 않음을 명시해주게 된다. 때문에 저렇게 최적화 과정을 통해 register를 사용하여 연산을 진행하고 그 값을 바로 메모리에 반영을 안해주는 것을 막아준다.

아래와 같이 바로바로 연산을 수행한 다음에 메모리에 넣어준다.

```cpp
mov eax, dword ptr [count]
add eax, 1
mov dword ptr [count], eax
mov eax, dword ptr [count]
add eax, 1
mov dword ptr [count], eax
mov eax, dword ptr [count]
add eax, 1
mov dword ptr [count], eax
```

그래서 공유되는 변수에 `volatile`을 쓰면 바로 연산 결과를 메모리에 바로 반영해주고, 값을 읽어올 때도 register에 저장되어있는 것을 읽어오는게 아니라 바로 메모리에 있는 것을 읽어오니까 문제가 해결된다는 것 같은데

이게 수행의 *원자성(atomic)*과는 또 다른 이야기라서 그것까지 고려하려면 좀 다른 수를 써야한다.
위에서 보면 ++count 연산을 수행하기 위해 3개의 assembly 명령어가 수행되는데, 만약 add eax, 1 까지 수행했지만 mov eax, dword ptr [count] 를 수행하지 않은 시점에서 다른 thread 가 count 의 값을 접근해버리면? 역시 마찬가지로 잘못된 값을 읽을 것이다.

이 때문에 수행 구간의 배타성(exclusive)을 보장해주기 위해서 mutex(mutual exclusion)를 설정해주는 것이다. 공부를 대충해서 설명을 참 못해놨는데, 마침 [설명이 잘 된 링크](http://skyul.tistory.com/337)를 찾았으니 들어가서 보면 좋겠다.

`volatile`을 붙이면 메모리에 값을 바로 반영해주므로 여러 thread 에서 공유되는 flag 변수를 사용할 때는 volatile keyword를 사용해야 문제가 덜 생긴다. 하지만 flag 값 역시 누군가는 대입하고, 누군가는 읽을텐데 대입의 과정 역시 assembly instruction으로 한 명령이 아니기 때문에 문제가 될 수 있다.
즉, 대입하는 thread 가 아직 메모리에 반영을 안한 시점에 읽는 thread가 읽어버리면 잘못된 flag 값을 통해 잘못된 수행을 할 수 있다는 것이다.

이 때문에 lock을 써 mutex 구간으로 설정하든 아래의 interlocked operation을 사용해야한다.

### interlocked ###

연산의 원자성이란 해당 연산이 multi-thread 환경에서 중간에 switching이 되어도 그 연산에 문제가 안 생기게 잘 수행된다는 이야기인데, 다음 예제를 보자

```cpp
class Object
{
public:
    void Hit (void) { ++mCount; }
    Object (void) : mCount (0) {}
private:
    int mCount;
```

이 `Object` class의 객체는 몇 개의 thread에서 공유되는 변수이다. 그리고 `Hit`이라는 함수를 통해 각 Thread가 Object에 접근하는 회수를 측정한다고 하자.

이 연산에 대해 컴파일러는 대충 이런 기계어를 만들어낼거다.

```cpp
mov eax, dword ptr [this]
mov ecx, dword ptr [eax]
add ecx, 1
mov edx, dword ptr [this]
mov dword ptr [edx], ecx
```

* 먼저 this의 주소의 주소 값을 가져와서 eax에 넣는다. 그럼 거기가 this의 주소가 될 것이다.
* 그 this를 또 dword ptr, 즉 this 가 가리키는 첫 번째 지점이 첫 번째 멤버 변수인 mCount가 되므로 ecx는 mCount 의 값이 들어간다.
* 그리고 add 로 1을 증가시키고, 그 결과를 다시 this 가 가리키는 곳에 넣는다.

(위 assembly 는 visual studio 2010 에서 만들어준 코드인데, 값을 쓰는 과정에서 this 를 다시 edx에 가져오는 코드를 사용하는 이유는 잘 모르겠지만 추측해보면 최적화 없이 기계적으로 만들어진 코드이므로 eax의 값이 변경될 것을 고려하여 다시 this의 위치를 가져오는 것이 아닐까 한다)

위에서 언급했지만 Thread가 2개가 있을 때, Thread 1이 `add ecx, 1`까지만 수행한 상태에서 Thread 2가 `mov ecx, dword ptr [eax]`를 수행해버리면 Thread 1의 연산결과가 아직 mCount에 반영되어있지 않으므로 Thread 2는 Thread 1의 연산 결과를 무시할 것이다.

즉, Thread 1이 처음에 0을 가져와서, 1을 더해서 그 결과를 mCount에 넣는다.
Thread 2가 처음에 0을 가져와서(아직 Thread 1의 연산 결과가 반영되지 않았으므로), 1을 더해서(그러므로 결과는 1) 그 결과를 mCount에 넣는다. (따라서 mCount 의 최종 결과는 1이 된다)

이렇듯 두 개 이상의 Thread가 동시에(하나의 core에서 switching 되든 다른 core에서 simultaneously 하게 돌아가든) 수행될 경우 전혀 예측과 다른 결과가 나온다는 것이다.

따라서 저렇게 여러 Thread에서 접근하여 수행되는 코드 중 공유되는 자원이 있을 경우 올바른 수행을 위해서 lock 등을 사용하여 배타적 실행을 보장해준다.  
(하지만 kernel 단에서 관리해주는 세마포어는 꽤 큰 비용이 들고, spin lock 역시 cpu 소모를 피할 수 없다. 하지만 lock 을 사용했을 경우 가장 곤란한 문제는 dead lock이다.)

위와 같은 `Hit` 함수를 lock 으로 보호한다면 대충 이럴 것이다.

```cpp
void Object::Hit (void)
{
    lock();
    ++mCount;
    unlock();
}
```

하지만 lock 등으로 보호해야 할 영역을 생각해보면 굉장히 그 영역이 축소된다.

* 위의 코드에서는 단순히 mCount를 증가시키는 부분만 원자적으로 수행되면 되고,
* 여타 Concurrent Data Structure를 보면 Stack(Node 기반)에서는 공유되는 변수인 Stack Head Pointer,
* Queue(Node 기반)에서는 공유되는 변수인 Head와 Tail

즉 공유되는 변수, 즉 멤버 변수만 원자적인 연산을 사용하게 되면 lock 범위를 함수 전체가 아니라 한 명령 구문으로 줄일 수 있다는 것이다. (Compare And Swap 등)

그래서 intel에서는 이를 위한 interlocked instruction을 제공해 주었고, MS에서는 이를 wrapping하여 [Interlocked API](http://msdn.microsoft.com/en-us/library/ms684122.aspx)으로 지원해준다.

```cpp
void Object::Hit (void)
{
    // 함수 인자 type 맞춰주기 위해 mCount 는 LONG type 이 되어야한다.
    InterlockedIncrement (&mCount);
}
```

위와 같이 작성하면 내부에서 mCount의 주소를 `InterlockedIncrement`로 넘겨준다. 그러면 `InterlockedIncrement` 함수에서는 저 메모리 주소를 가지고 있다가 내부에 lock 붙은 operation 수행을 통해(?) 그 주소가 가리키는 값을 1 증가시켜주는 것을 원자적으로 수행시켜준다.

즉, 저 코드는 여러 thread 에서 동시에 실행을 해도 증가시켜주는 구문인 `InterlockedIncrement` 함수가 원자적으로 증가시켜줌을 보장해주기 때문에 문제가 없다.
