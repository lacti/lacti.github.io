---
layout: post
title: 개발중인 Remote Library 중간보고
tags: java rpc
---

PHP의 `__call method`는 해당 object의 member를 호출했을 때, 그 member가 not implement 상태이면 `__call method`로 method name과 arguments를 넘겨주는 그런 신비한 method이다.  
예외처리도 아니고 없는 method에 대해 해당 method 호출 정보를 넘겨받을 수 있는 함수라니! 이건 진정한 proxy class를 제작하기 위한 필수 method라 할 수 있겠다.

### 본론 ###

java에는 이런 것이 없을까.

이에 대해 고민하다가 `proxy`를 만들 `interface`에 대해 class information(?)을 읽어들여서 proxy class code를 generate하고, 그 code로 bytecode를 만들어서, 그 bytecode로부터 class를 생성하는 방식을 생각해냈다.  
하지만 code -> bytecode -> class -> object 이게 그리 쉽지만은 않아 javacompiler를 고민하고 있었는데, 의외의 것을 찾았다. 그것은 바로 `java.lang.reflect.Proxy`

이런 말도 안되는 class가 있었다  
내가 하려는게 구현되어있는(native라서 코드를 못 보고 있다.) class인데, `getProxyClass`와 `newProxyInstnace` method를 통해 proxy class나 instance를 얻을 수 있다!

그러면 해당 `interface`로 casting해서 함수를 호출했을 경우, 저 `proxy class`에 bind된 `InvocationHandler`의 함수가 호출되는 것이다. 이로써 remote library 1차 완성

### 결론 ###

RMI를 사용하다가 `RemoteException`이 발생할 때 보면, stack trace에서 `$Proxy0.class`와 같이 inner class로 구성된 Proxy라는 이름의 class파일이 존재하게 되는데, 이것이 바로 위에 설명한 저 `Proxy` class를 이용하여 RMI를 구현했다는 것이 되겠다.

이제 보다 효율적인 communication을 위해 단순 Socket을 사용하는 것이 아니라 `SocketChannel`을 사용, 비동기 IO를 적용시켜 진정한 Remote Library를 만드는 일이 남았다. 공부하러 가야겠다.


### 참고 ###

* http://java.sun.com/j2se/1.4.2/docs/guide/reflection/proxy.html
* http://java.sun.com/j2se/1.4.2/docs/api/java/lang/reflect/Proxy.html
* http://java.sun.com/j2se/1.4.2/docs/api/java/lang/reflect/InvocationHandler.html
