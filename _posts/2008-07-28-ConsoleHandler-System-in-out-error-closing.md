---
layout: post
title: ConsoleHandler와 System.in/out/error의 closing
tags: java
---

`java.util.logging`의 Logger 쓰는 맛을 들이고 있는데
어느 순간부터 Exception이 나오지를 않는 것이다.

찾아보니까 알게 된 사실

* Exception이 빨간 글씨로 나오는게 싫어서 `ConsoleHandler`의 OutputStream을 `System.out`으로 설정하려고 했다.
* 근데 이상하게도 setOutputStream이 protected이더라.
* 그래서 당당히 `ConsoleHandler`를 상속받아 `setOutputStream`을 `System.out`으로 설정해주었다.

이게 문제였다.

* `setOutputStream`은 OutputStream이 변경될 때 기존에 설정된 OutputStream을 닫는다. (`flushAndClose()`)
* 덕분에 기존에 설정된 OutputStream인 `System.err`이 닫힌다
* 그래서 `System.err`로 출력될 Exception들이 하나도 안 나오는것.

왜 `setOutputStream`을 protected로 숨겨놨나 했더니.
결국 방법은 ConsoleHandler 복사해서 `setOutputStream`을 `System.out`으로 바로 설정시키는 방법 뿐.

그런데 이것도 실수로 닫아버리면 아무런 메시지도 출력 안되는 것인가-_-;

-----
어쩐지 전에 Scanner에 `System.in` 넣어서 쓸 때 `Scanner` 객체 두 번 만들어서 쓰면 두 번째 Scanner 객체에서 키보드 입력을 못 받더니 같은 이유이다.

할당한 것은 해제해주어야 하고, 연 것은 반드시 닫아야한다는 신조를 갖은 나는 `Scanner`에 `System.in` 넣어서 쓰고 닫고, 다음에 또 `Scanner`에 `System.in` 객체를 만들면
이미 닫혀져버린 `System.in`으로 입력을 받을 수 없기 때문이다.

[구글에서 찾은 Java쪽 Thread](http://forums.sun.com/thread.jspa?threadID=5232911&messageID=9952697)인데, 왜 진작 찾아볼 생각을 안 했을까. 뭐라고 검색해야 할지 몰라서 키워드를 찾는데 한참 걸렸으니까.