---
layout: post
title: C# UI Cross thread problem 해결
tags: c#
---

다른 Thread에서 UI component에 접근하려면 문제가 발생한다. (cross thread)
동기화 이슈에서보면 당연한 이야기니 바로 해결책을 보자.

`System.Windows.Forms.Control`에는 `Invoke`라는 UI thread로 작업을 delegate하는 method가 있다.이 녀석은 Delegate 를 받아서 그걸 내부에서 수행해주는데, C#에서는 어차피 외부 변수 capture를 자동으로 해주므로 간단히 다음과 같이 쓰면 된다.

```csharp
Invoke(new MethodInvoker(delegate()
{
    // code for running in ui thread
}));
```

그러면 delegate 내부의 내용은 UI thread에서 수행되므로 문제가 없다.

더 예전 버전의 C#은 직접 method를 만들어서 등록해주어야했지만 2.0이후부터는 delegate로 익명 함수자 생성이 가능하므로 문법이 좀 간단해졌다. (C# 4.0부터는 lambda를 지원하니까 문법이 더 간단해지지 않았나?)