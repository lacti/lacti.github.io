---
layout: post
title: Interlocked Singly Linked Lists
tags: concurrency -pub
---

Concurrent Data Structure는 Lock을 최소화하여 동작해야 multi thread에서 해당 자료구조에 접근할 때 발생하는 부담이 최소화되어 효율적인 프로그래밍이 가능하다.

여러가지 방법이 있겠지만, 가장 간단한(?) Windows API로 제공되는 [Interlocked Singly Linked Lists](http://msdn.microsoft.com/en-us/library/ms684121.aspx)에 대해 보자. (이후 SLIST 라고 이야기하겠다)

SLIST는 단방향(singly) Linked List로 구성된 Stack이다. MSDN 을 보면 non blocking atomic 동기화 알고리즘으로 쓰면 성능 향상에 도움이 되고 multi thread에서 사용해도 문제가 없댄다. 아무튼 이래 저래 좋다고 한다.

일단 SLIST 의 사용법을 보기에 앞서 2가지만 짚고 넘어가자.

### 왜 Stack 일까? ###

정확한 이유는 모르겠는데, 다음의 이유로 무리한 추측을 해보자.

1. Stack이면 가장 최근에 Push했던 것이 가장 먼저 Pop된다. 즉, 굳이 멀고 먼 Memory까지 안 가도 Cache에서 적중되어 가져올 수 있는 확률이 있다. 그런데 multi thread에서 안전하게 돌아가기 위한 lock operation을 쓴다는 것은 결국 메모리에 내용이 바로 반영되야한다니까 cache 이야기는 좀 아닌 것 같다.

2. Queue는 Concurrent Data Structure 알고리즘 구현이 Stack에 비해 복잡하다. Stack은 관리해줘야할 공유 변수가 하나(Stack Pointer)이지만 Queue 는 2개(Head, Tail)이다. 그런데 똑똑한 MS 양반들이 Queue가 더 복잡하다고 해서 안 해놨을 것 같지는 않다.

3. Stack으로도 충분했다. 굳이 Queue까지 API로 제공하지 않아도 Stack만으로도 Queue나 다른 자료구조를 구현해서 쓸 수는 있다. 그럼 왜 하필 Stack을 만들어놨을까? 누가 좀 알려주세요 [...]

찾아보면 [SLIST 기반으로 Queue처럼 쓰는 예제](http://alexkr.com/memos/16/non-blocking-singly-linked-list/) 도 있다.

### 왜 Memory Alignment 이야기가 나올까? ###

MSDN을 보면 모든 항목들은 `MEMORY_ALLOCATION_ALIGNMENT`로 정렬되어있어야 한다고 써있다.

> All list items must be aligned on a MEMORY_ALLOCATION_ALIGNMENT boundary

그 이유는 아마도 CPU가 해당 메모리 값을 가져와서 lock operation을 수행할 때 이게 적절치 못하게 메모리에 걸쳐 있으면 한 번에 Fetch를 할 수가 없기 때문일 것이다.

SLIST에서는 SLIST_ENTRY라는 객체를 사용하는데 이걸 메모리에서 가져와서 CPU가 lock operation 걸고 원자적으로 변경을 수행하면서 thread safe하게 작업하는 것이다. CPU는 MEMORY_ALIGNMENT단위로 메모리로부터 값을 가져와서 처리할 수 있는데, 만약 그 값이 4라고 해보자.

즉, CPU가 메모리 주소 4 단위로 읽을 수가 있다. 그런데 저 SLIST_ENTRY 값이 오묘하게 메모리 주소 3부터 6까지 (3, 4, 5, 6) 4 Bytes 가 존재한다고 하면, CPU는 저걸 한 번에 가져와서 작업을 수행할 수가 없다. 적어도 0 ~ 3까지 1번(0, 1, 2, 3), 그리고 4 ~ 7까지 1번(4, 5, 6, 7) 총 2번 8Bytes를 가져온 다음에 3부터 6까지의 Bytes를 추려서 작업에 임해야 한다.

그래서 SLIST를 사용할 때는 각 항목들을, 즉 각 항목들의 메모리 주소를 정렬해야한다는 것이다.

*(추후 추가하자면 위 내용은 좀 잘못되었다. 실제로 bus size만 놓고 생각한다면 `MEMORY_ALLOCATION_ALIGNMENT` 값처럼 큰 값으로 정렬을 요구할 필요가 없다. 오히려 DCAS 부재로 인한 ABA problem을 막기 위한 주소bit의 추가 공간 확보가 더 정확한 설명일 것이다.)*

갑자기 항목에서 왜 항목의 주소로 넘어가는지는 SLIST_ENTRY 구조체 속을 들여다보면 알 수 있다.
WinNT.h 파일에 보면 SLIST_ENTRY type 은 아래와 같이 정의되어 있다.

```cpp
typedef struct _SINGLE_LIST_ENTRY {
    struct _SINGLE_LIST_ENTRY *Next;
} SINGLE_LIST_ENTRY, *PSINGLE_LIST_ENTRY;
#define SLIST_ENTRY SINGLE_LIST_ENTRY
```

즉, 각 항목이라는 것은 결국 내부에서 다음 node를 가리키는 주소를 포함한다. 왜냐하면 singly linked list이니까.  
그러면 저 Next 변수는 CPU 가 lock operation 을 통해 한 번에 작업을 수행해야 하므로 MEMORY_ALIGNMENT되어 있어야 한다. 그런데 저기(Next)에 들어가는 값이 다음 항목의 메모리 주소이고, 또 그 다음 항목의 Next 변수를 가지고 CPU가 작업을 해야하니까 그 Next 변수를 갖는 SLIST_ENTRY도 메모리 정렬이 되어있어야 한다.

따라서 모든 항목의 주소가 메모리 정렬 되어있어야 하는 것이다.

역시 WinNT.h 파일에 보면,

```cpp
#if defined(_WIN64) || defined(_M_ALPHA)
#define MAX_NATURAL_ALIGNMENT sizeof(ULONGLONG)
#define MEMORY_ALLOCATION_ALIGNMENT 16
#else
#define MAX_NATURAL_ALIGNMENT sizeof(DWORD)
#define MEMORY_ALLOCATION_ALIGNMENT 8
#endif
```

와 같이 `MEMORY_ALLOCATION_ALIGNMENT` 값이 정의되어 있음을 볼 수 있다.

### 어떻게 사용하나? ###

* 먼저 Stack의 Head를 `InitializeSListHead` 함수로 초기화해야한다.
* 그리고 Push(`InterlockedPushEntrySList`)와 Pop(`InterlockedPopEntrySList`)을 수행한다.
* `InterlockedFlushSList` 함수가 있다. 이는 Stack 에 들어있는 모든 Node 를 반환하는 함수다. 이 함수를 수행하면 Head 는 초기화된다. 즉 빈 Stack 이 된다.
* 이 외에 개수를 세는 `QueryDepthSList`까지 있다.

아무튼 다 MSDN 에 예제까지 친절히 나와있으므로 자세한 설명은 생략한다.

`SLIST_ENTRY` 항목들의 메모리 주소는 정렬되어야 한다. 이를 일단 SLIST로 관리해야할 Node들이 `SLIST_ENTRY` 객체를 멤버로 가져야하고, SLIST_ENTRY 멤버 변수들의 주소는 `MEMORY_ALLOCATION_ALIGNMENT` 값으로 정렬 되어있어야 한다.

가장 간단한 방법은 다음과 같다.

```cpp
struct MyItem
{
    SLIST_ENTRY ListEntry;
    // Other Variables
};
```

첫 번째 멤버 변수로 넣어준다. 그리고 MyIem 을 할당할 때 내부에서 [`_aligned_malloc`](http://msdn.microsoft.com/en-us/library/8z34s9c6.aspx) 와 같은 함수로 할당해주면 MyItem 의 주소가 정렬되니까 첫 번째 멤버 변수인 ListEntry (SLIST_ENTRY) 의 주소도 정렬된다(같은 값이니까)

같은 방법인데, 저걸 상속으로 표현하자는 사람도 있다. 상속하면 Base Type 의 멤버들이 메모리의 가장 위 쪽으로 올라가니까. 하지만 그게 모든 컴파일러에서 보장되도록 표준화되어있는 내용은 아닌 것으로 알고 있으니까 글쎄, 좋을지는 모르겠다.

이와 같은 이유로, virtual function pointer table 을 갖는 class type 에서 SLIST_ENTRY 을 멤버로 넣어 사용할 경우, 과연 이 변수를 정렬하기 위해서는 어떻게 해야할까 고민이 좀 되는데, 그냥 그러지 말자고 하고 싶다-_-

아무튼 저렇게 만들어놓고 꺼내서 쓸 때는 단순히 casting 만 해서 쓰면 되니까 편하다.

```cpp
MyItem* item = (MyItem*) InterlockedPopEntryList (listHead);
```

궁금할 것 같은 내용은 위에서 다 풀어 써놨으니까 간략한 예제를 보자. 예제는 [MSDN: Using Singly Linked List](http://msdn.microsoft.com/en-us/library/ms686962.aspx)에 있다.

먼저 `LIST_HEADER`를 만들어줘야한다. 이는 사용할 SLIST의 Head 포인터이다. 당연한 이야기이지만 이것도 메모리 정렬이 되어야 한다.

```cpp
pListHead = (PSLIST_HEADER)_aligned_malloc(sizeof(SLIST_HEADER),
       MEMORY_ALLOCATION_ALIGNMENT);
```

`PROGRAM_ITEM`이라는 구조체가 첫 번째 멤버 변수로 `SLIST_ENTRY`를 갖는다. 따라서 `PROGRAM_ITEM` 객체의 메모리 주소만 정렬해주면 된다.

```cpp
pProgramItem = (PPROGRAM_ITEM)_aligned_malloc(sizeof(PROGRAM_ITEM),
            MEMORY_ALLOCATION_ALIGNMENT);
```

꺼내서 쓸 때는 어차피 `SLIST_ENTRY`의 주소가 곧 `PROGRAM_ITEM`의 주소이므로 casting만 해서 쓰면 된다.

```cpp
pListEntry = InterlockedPopEntrySList(pListHead);
pProgramItem = (PPROGRAM_ITEM)pListEntry;
```

### 정리 ###

이러한 구조가 어디에서 쓰일까. multi thread 에서 접근해야하는 자료구조일 경우 쓰이겠다. 예를 들면,

* 작업 queue
* log queue
* 메모리 관리자

queue 시리즈야 예제에서 이미 봤고, 메모리 관리자 이야기를 잠깐 해보자.

재활용이 가능한 메모리들이 있다. 이런 것들을 pool 형태로 관리하여 할당 부담을 줄이고 단편화를 줄이기 위한 관리자를 만든다고 하자. 자원 할당은 여러 thread에서 접근해야하니까 병목 지점이고, 이 때문에 lock은 최대한 적게 썼으면 좋겠다.  
그러니까 미리 지정된 크기만큼 메모리를 다 할당해서(보통 크게 할당해서 쪼개놓고) SLIST에 다 넣어둔다. 그리고 요청할 때마다 하나씩 Pop해서 쓰게 해준다.

뭐 어떤 이야기에 따르면, 다 쓰고 Push한걸 다음에 바로 Pop을 하면 이 메모리가 아직 cache에 남아있어서 바로 hit되어 빠르게 사용할 수 있다는 좋은 이야기가 있는데 이게 얼마나 효용이 좋은지도 모르겠고, 그리고 Windows Vista부터는 LFH(Low Fragmentation Heap)이 기본 Heap이라서 저 작업이 뻘짓이라는 이야기도 있다.

결론이 좀 이상해졌는데 아무튼 Windows API가 제공해주는 SLIST를 사용하여 multi thread 환경에서 보다 빠른 프로그램을 작성할 수 있다니까 믿고 써보자.