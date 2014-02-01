---
layout: post
title: Java의 equals의 세계
tags: java
---

* boxing/unboxing이 지원되는 Java 5 이후부터 숫자형 Wrapper Class 객체에 대해 `equals`와 == 연산자는 과연 어떻게 동작할 것인가
* class 주제에 primitives라고 이야기하는 `String class`의 `equals`와 == 연산자는 과연 어떻게 동작할 것인가
* 그리고, 만약 위의 객체들이 `Vector<Object>`에 들어가서 `Object`로 pointing될 때, `equals`와 == 연산자는 과연 어떻게 동작할 것인가!

### Compare Object ###

* Long(123) equals 123? `false`
* Long(123) equals new Long(123)? `true`
* Long(123) == 123? `true`
* String("hell") equals "hell"? `true`
* String("hell") == "hell"? `true`

### Compare Object with pointed Object. ###

* Long:Object(123) equals 123? `false`
* Long:Object(123) equals new Long(123)? `true`
* Long:Object(123) == 123? `true`
* Long:Object(123) == new Long(123)? `false`
* String:Object("hell") equals "hell"? `true`
* String:Object("hell") == "hell"? `true`

### 결론 ###

숫자형이 Wrapper Class로 싸여있을 때는 == 로 비교해야 원하는 결과가 나온다.  
*(boxing되어 Long 객체로 넘어가니까 equals에서 제대로 동작할 줄 알았는데 좀 의외였다.)*

String 객체는 친절하게도 ==나 equals 모두 가능하다.

**추가**

디버깅을 통해 원인을 찾았다

```java
Long l = new Long(123);
l.equals(123);
```

이라는 코드에서 `l.equals` 함수의 인자로 들어가는 123은 boxing될 때 Integer로 boxing된다.
`Long#equals`에서는 비교하는 대상의 객체가 `Long`의 instance가 아니니 `false`를 반환하는 것이다.

**정리**

boxing을 수행할 때는 해당 primitives의 변수형에 따라서 boxing을 수행하게 된다.
따라서 literal 숫자형은 `Integer`형으로 boxing이 되고, long 형의 변수라면 Long형으로 boxing되는 것이다.

즉,

```java
Long l = new Long(123);
l.equals((long) 123);
```

이처럼, 명시적으로 123을 `long`형으로 casting해주면 boxing될 때 `Long`으로 boxing되어 equals에서 참으로 나온다.

생각해보니 당연한 이야기.