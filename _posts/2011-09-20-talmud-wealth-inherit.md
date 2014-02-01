---
layout: post
title: 탈무드 이야기
tags: c++ -pub
---

탈무드에는 다음과 같은 이야기가 있다.

> 예루살렘에서 멀리 떨어진 곳에 어진 유태인이 살고 있었다. 그는 아들을 예루살렘에 있는 학교에 보냈다. 아들이 학교에서 공부하고 있는 사이에 아버지는 병이 들었다. 병세는 점점 깊어져 아무래도 아들을 만날 수 없으리라고 생각된 아버지는 유서를 썼다. 내용은 '전 재산을 한 노예에게 줄 것, 다만 재산 중에서 하나만 아들이 원하는 것을 아들에게 주라'는 내용이었다. 그 아버지가 죽자 노예는 그 아들에게 부친이 죽은 것을 알리고, 유서를 보여 주었다. 
>
> 이렇게 시작해서 노예의 재산은 결국 주인의 재산이므로 아들은 재산으로 노예를 선택했고 아버지가 남긴 유산도 얻을수 있었다.

프로그래밍적으로 접근해보자.

```cpp
class Person : public Container {};
class Wealth : public Container {};
class Owned : public Attribute {};
class Owner : public Attribute {};
```

사람과 재산은 여러 속성을 띌 수 있으므로 하나의 `Container`라 할 수 있다.
그리고 소유 관계를 표현하기 위한 `Owned`, `Owner`는 각각 속성이라 할 수 있다.

이 집에는 아버지, 아들, 노예가 있다.

```cpp
PersonRef father, son, slave;
```

저 객체들은 어떻게든 태어나서, 여지껏 자신의 상태를 잘 관리하며 살아왔을 것이다. 각자는 자신의 삶을 독립적으로 살아가므로 하나의 Agent로 봐도 되겠다.

여기서 아들은 공부를 위해 먼 곳으로 떠났다.

```cpp
GoStudy(son);
```

그런데 저 함수는 굉장히 복잡하기 때문에, `son` 객체는 저 함수의 수행을 완료할 때까지 상당한 시간을 소모할 것이다.

아버지는 상당한 재산을 가지고 있었다.

```cpp
WealthRef wealth;
wealth->GetAttribute<Owner>()->SetOwner(father);
```

하지만 아버지에게 위기가 찾아왔다. 아버지 객체의 생존 시간이 다 된 것이다.

```cpp
dieAndDestroy(father);
```

아버지는 저 함수의 수행이 끝나면 자신이 완전히 소멸된다는 점을 잘 알고 있다.

자신이 걱정하는 바는, 아들 객체가 `GoStudy` 수행이 끝나기 전에 자신의 `dieAndDestroy` 함수 수행이 완료될 것이라는 점이다. 그렇게 되면, 자신 객체는 모든 참조를 잃게 되고, 자신이 소유한 재산들은 모두 소유권이 사라지게 될 것이다.

왜냐하면 dieAndDestroy 함수는 자신이 소유한 모든 재산들의 소유권을 NULL로 만들기 때문이다.

```cpp
OwnedList& ownedList = father->GetAttribute<Owned>()->List();
std::foreach(ownedList.begin(); ownedList.end(); [=] (Owned* owned) {
    owned->SetOwner(NULL);
});
```

그러면 자신의 소유물 중 하나인 노예가 모든 소유 권한이 없어진 틈을 타서, 아들이 돌아오기 전에 모든 소유권을 자신에게 돌리게 될 것이다.

```cpp
OwnedList& ownedList = slave->GetAttribute<Owner>()->GetAttribute<Owned>()->List();
std::foreach(ownedList.begin(); ownedList.end(); [&slave] (Owned* owned) {
    owned->SetOwner(slave);
});
```

그래서 아버지는 현명하게도 자신의 정보를 유지할 방법으로 유서라는 객체를 만들었다. 유서라는 객체는 2개의 수행으로 나누어진다.

* **전 재산의 소유권을 노예에게 이전한다.**

```cpp
OwnedList& ownedList = father->GetAttribute<Owned>()->List();
std::foreach(wholeWealth.begin(), wholeWealth.end(), [&slave] (Owned* owned) {
    owned->SetOwner(slave);
});
```

이렇게 되면 노예는 굳이 아버지가 남긴 유산을 자신의 것으로 등록하는 redundant한 작업을 수행하지 않는다.

```cpp
if (slave->GetAttribute<Owner>() == slave)
    return;
```

* **아들이 원하는 재산 하나만 아들에게 소유권을 준다.**

이것은 굉장한 술책이다. 왜냐하면 아들 Agent는 현재 `GoStudy` 함수 수행이 끝나지 않은 상태인데,
아들이 **원하는** 재산 한 가지를 주어야하므로, 아들에게 무엇을 원하는지 물어봐야한다는 것이다.

그리고 당시의 시대상을 고려해볼 때 아들은 통신 기기가 발달하지 않았기 때문에 이에 대한 응답을 비동기적(전화나 인터넷 메일 등)으로 공부하다가 중간에 잠깐 응답할 수가 없고, 동기적으로 집까지 와서 해당 재산을 선택해야한다는 것이다.

따라서 이 유서는, 굉장하게도, 2번째 단계에서 지연된 수행을 시도한다.

```cpp
struct Will2Phase : public DeferredJob {
    void operator () (void) {
        Owned* oneOfWealth = son->choose(mWholeWealth);
        oneOfWealth->SetOwner(son);
    }
    Will2Phase(OwnedList& wholeWealth, PersonRef son)
        : mWholeWealth(wholeWealth), mSon(son) {}
    OwnedList& mWholeWealth;
    PersonRef mSon;
} will(wholeWealth, son);
son->request(will);
```

유서라는 이 Transaction은 완료가 되어야 정식 발효가 되는 그런 개념은 아니다.

하지만 일말의 양심이 있는 노예는, 재산 소유의 정당성을 얻기 위해, 유서 집행을 서두른다. 덕분에 아들은 비동기적으로 아버지 객체의 Destroy 소식을 들을 것이고, 자신이 수행하던 `GoStudy` 함수의 수행을 중단하고 그 다음 작업인 `Will2Phase::operator() (void)` 를 수행하게 될 것이다.

현명한 아버지의 아들답게, 아들은 `choose` 함수를 통해 `wholeWealth` 목록 중에서 노예를 선택한다. 그게 가능한 이유는 `wholeWealth` 라는 것이 capture된 시점 자체가 **아버지의 유서를 작성한 시점이기 때문에** 비록 그 내부 원소들의 소유권은 노예에게 돌아갔지만, 아직 **그 목록에는 노예가 포함** 되어있기 때문인 것이다.

* 만약 아버지의 유서가, 그럴리는 없겠지만, "전 재산을 한 노예에게 줄 것, **그의 재산** 중에서" 라고 유서를 작성했으면 `wholeWealth` 목록을 갱신해야하므로 아들은 망했을 것이다.
* 하지만 프로그래밍을 하다보면 이런 실수는 꽤 있다

그리고 소유권 이전 문제. 본 글을 처음 작성했던 동아리 친구가 언급한대로 **x∈y and y∈z이지만 x∈z는 성립하지 않는다.**

유서가 모두 집행된 상태에서 breakpoint를 걸어 객체들의 상태를 보면, 아들은 단 하나의 객체, 즉 노예에 대한 Owner일 뿐이고 아직 남은 다른 재산들은 모두 노예에게 소유권이 있다. (갱신을 안 했으니까!)

그런고로, 아들이 진정 모든 재산의 소유권을 얻으려면 다음의 작업을 해야한다.

```cpp
OwnedList& remains = oneOfWealth->GetAttribute<Owned>()->List();
std::foreach(remains.begin(), remains.end(), [&son] (Owned* owned) {
    owned->SetOwner(son);
});
```

하지만 이런 당연한 사실을 구구절절히 읊는 것은 탈무드의 격이 떨어지는 것.  
따라서 이 구절을 간단하게 *"현명한 아들은, 아버지의 뜻을 깨닫고, 모든 재산을 얻을 수 있었다"*과 같이 표현한 것이다. 요새 말로 하자면 **더 이상의 자세한 설명은 생략한다** 정도?

다 쓰고 보니 공유 자원에 대한 monitor 드립과 권한 문제 드립을 안 쳤네 [...]