---
layout: post
title: stl operator 실수
tags: c++ -pub
---

어제 나를 1시간동안 고민하게 한 코드는 다음과 같다.

```cpp
class CMyData {
    int GetKey (void) const { return m_nKey; }

    CMyData (void) {}
    ~CMyData (void) {}

private:
    int m_nKey;
};
std::list<CMyData> gCache;
BOOL Find (std::list<CMyData>& list, int key) {
    for (std::list<CMyData>::iterator iterator = gCache.begin ();
        iterator < gCache.end (); ++iterator) {
        if (iterator->GetKey () == key) list.push_back (list);
    }
    return list.size () != 0;
}
```

어제 정신이 없었다고 변명을 해도 너무 어이없는 실수를 저질렀는데 더 큰 문제는 컴파일에서 뱉어주는 에러를 보고도 해당 문제를 파악하지 못했다는 것이다.

위 코드의 문제는

* 나는 OOP 수업의 영향으로 class declaration에서 public - protected - private 순으로 선언을 하고, public method를 선언할 때 가장 마지막 부분에 생성자 소멸자를 선언한다. **그런데 class 선언할 때 맨 앞에 public을 빼먹었다.**

`GetKey()` 접근 위반 에러를 먼저 봤다면 괜찮았을텐데, `std::list` 쪽에서 `CMyData`의 소멸자를 호출하지 못한다는 에러만 보고 *소멸자 제대로 선언했는데!*를 외쳤으나 `public:`이 빠진건 보지 못했다.

* stl container의 iterator를 사용할 때는 `begin`으로부터 시작해서 `end`가 아닐 때까지 반복하는거다. 그래서 당연히 `iterator != list.end();`으로 써야하는데 대체 무슨 정신으로 저기에다가 `operator <`를 써놨는지 모르겠다.

결론은 술먹고 코딩하는 것보다 졸면서 코딩하는게 100만배는 더 해롭다는 사실.  
저거 잡는데 1시간 반정도가 걸렸는데, 사실 잠 깨는데 1시간 걸리고 30분 동안 내가 졸면서 뭘 짜고 있었는지 파악하는게 걸린것 같다.