---
layout: post
title: 닫힌 descriptor와 write, SIGPIPE
tags: c io -pub
---

예전에도 엄청 고생했던 것인데, `socket`이나 pipe 등에서
`read`와 `write`로 IO를 수행할 때 상대쪽(opposite endpoint)이 닫혔다면 어떤 현상이 벌어질까?

* `read`는 -1을 반환한다
* `write`는 SIGPIPE를 받는다.

하지만 프로그램이 `signal handler`를 만들지 않았다면 그 프로그램은 죽는다.  
SIGTERM이나 SIGQUIT를 받은게 아니기 때문에 **조용히 죽는다.**

`send`/`recv`를 사용해서 옵션을 주면 깔끔하게 `EPIPE`를 반환하게 할 수 있는데 `write`, `read`는 그런 옵션이 생략된 *범용적* 함수라서 `signal handler`를 설치하는 수 밖에 없다.

stackoverflow에 나와있는 [how to prevent sigpipes or handle them properly](http://stackoverflow.com/questions/108183/how-to-prevent-sigpipes-or-handle-them-properly)를 보면

```c
int set = 1;
setsockopt(sd, SOL_SOCKET, SO_NOSIGPIPE, (void *)&set, sizeof(int));
```

와 같이 해결가능하다고 하는데 범용적이지는 않다.

그래서 결국 `sigaction`으로 handler 설치해주고 작업을 해야하는데
단, signal 함수를 써서 handler를 지정했다가는 **os에 따라서 한번밖에 handler가 설정 안되는 경우가 있으므로 주의**가 필요하다.
