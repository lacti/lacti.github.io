---
layout: post
title: LockWindowUpdate
tags: c++
---

Win32 혹은 MFC를 하다보면  
어떤 창 내에 여러 Child Window가 존재하고, 또, 해당 DC를 얻어서 그림을 그려야하는 경우가 생긴다.

이들이 모두 변경되는 경우, 즉 그림도 변경되고 Child Window도 `SetWindowPos` 등의 함수를 통해 변경될 경우에
그림은 `InvalidateRect()` 등의 함수에 의해 다시 그려질 것이나  
Child Window는 `SetWindowPos`나 `ShowWindow`함수가 호출되는 즉시 변경이 되기 때문에 UI가 **한번에 갱신되지 않고 지역별로 갱신되는 문제**가 발생한다.

이를 동기화하려면 부모 Window의 `WM_PAINT` 메시지와 Child Window의 `WM_PAINT`가 동기적으로 일어나야 한다.
하지만 어차피 부모 Window `WM_PAINT` 수행될 때 InvalidateRect 영역 내에 있는 Child의 Window에 대해서도 `WM_PAINT`가 다 수행되므로 개별 UI만 갱신되지 않도록 막아주면 된다.

따라서,

* `LockWindowUpdate` 함수를 통해 부모 Window에 Lock을 걸어 Child Window가 수정되어도 `WM_PAINT` 가 수행되는 것을 막고 
* 모든 작업이 끝난 후에 `LockWindowUpdate(NULL)`을 호출하여 `UpdateWindow`를 수행해 줌으로써 화면을 갱신해주면 되겠다.
