---
layout: post
title: java annotation을 사용한 InstanceId 구현
tags: java -pub
---

Java에서 생성하는 `Object`마다 InstanceId를 부여하는 방법에 대해 고민해보고 코드를 작성해보자.

Index 발급 Group 관련해서 파일을 하나 작성하여 `IndexGeneratingManager`를 구성해서 발급해도 되고, 아니면 발급 받는 시점을 적절히 조절하거나 발급 함수의 인자로 Group할 Class 정보를 넣어줘도 되겠다.  
하지만 본 글에서는 Java 1.5부터 추가된 `Annotation`을 사용하여 source code에 metadata를 추가하여 문제를 해결하는 방법을 써 보겠다.

Java의 `Annotation`은 특정 지점(ElementType: Type, Method, Field, ...)에 특정 시점(Retention: Source, Class, Runtime)까지 유지되는 metadata이다.  
`@interface keyword`로 정의할 수 있고, 지정된 지점에 맞게 class, method, field, parameter 등에 선언될 수 있고, 이는 지정된 시점까지 유지된다.

위 문제를 해결하기 위해 새로 작성하는 `IndexCategory`라는 annotation은 index를 발급할 `category` class를 지정한다.

```java
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface IndexCategory {
	public Class<?> category();
}
```

이 annotation은 `Type`에 선언될 수 있는데, 여기서 `Type`은 `class`를 뜻한다.  
또한 Runtime까지 유지되는 정보인데, 그 이유는 객체가 "생성되는 시점"인 runtime에 해당 정보를 통해서 어떤 category의 class type으로 index를 발급받을지 얻어내야하기 때문이다.

annotation은 속성`property`를 갖는데, `IndexCategory`는 `category()`라는 속성을 갖는다. 이는 `Class<?>`를 값으로 갖는 속성으로 그 이름은 category가 된다.

위와 같은 `IndexCategory` annotation을 다음과 같이 사용하고자 할 class에 적용한다.

```java
class Skill extends Thing {}

@IndexCategory(category=Skill.class)
class Magic extends Skill {}

@IndexCategory(category=Skill.class)
class Mastery extends Skill {}
```

`Magic` class와 `Mastery` class는 `IndexCategory`에 의해 어떤 category에 따라 index를 발급받을지 code 상에 명시한다.
분명 이 annotation은 프로그램의 동작에 영향을 주지만, 어떠한 코드로써 그 정보를 제공한다기 보다는 metadata로 그 정보를 제공한다는 점에서 충분히 매력적이다. 어떠한 class의 특성을 명시하기 위해 method나 field, 상속 등의 무거운 방법을 사용하지 않고, 위처럼 `annotation`을 통해 충분히 정보를 제공할 수 있다.

문법상 annotation을 사용할 때 앞에 @ 을 붙이고 annotation 이름을 쓴다. 그리고 () 안에 *속성=값*의 형태로 나열하면 되고, 배열의 경우 {}를 통해 묶어주면 된다.

이러한 annotation을 가장 많이 접하는 경우가 `Override annotation`과 `Deprecated annotation`, 그리고 `SuppressWarnings annotation`이다.  
간단히 `Override annotation`만 설명하자면 이는 method에 선언 가능하며 source 시간까지 유지되는 `annotation`이다. 즉 compiler가 확인하고 버리는 시점까지 유지되는 `annotation`으로 `override` 되지 않은 method가 이 `annotation`을 가지고 있을 경우 compile error를 띄워주는 역할을 하여 compile time에 잘못된 override를 사전에 보고하는 역할을 한다.

위와 같이 `IndexCategory` annotation을 명시한 뒤, 객체를 생성하여 index를 발급하는 코드에서는 이를 반영하여 index를 해주면 된다.

```java
public static int generateNextIndex() {
	String callerClassName = findCallerClassName();
	try {
		Class<?> callerClass = Class.forName(callerClassName);
		if (callerClass.isAnnotationPresent(IndexCategory.class)) {
			IndexCategory category = callerClass.getAnnotation(IndexCategory.class);
			Class<?> categoryClass = category.category();
			return generateNextIndex(categoryClass);
		}
		return generateNextIndex(callerClass);
	} catch (Exception e) {
	}
	return generateNextIndex(callerClassName);
}
```

`callerClassName`을 가져와서 그로부터 Class 정보를 가져온 뒤, 그 Class가 `IndexCategory` annotation이 존재`present`할 경우 해당 annotation에 명시된 category로부터 category class 정보를 가져와서 그 class로 index를 발급하겠다는 코드이다.

즉, 반드시 `IndexCategory`를 통해 index grouping을 수행하겠다는 것이 아니라 `IndexCategory` annotation이 present된 경우에만 해당 class로 index를 발급받는 것이므로, annotation이 선언되지 않은 경우까지 완벽히 처리하게 됩니다.

물론 `callerClassName`에서 잘못된 class 이름을 얻을 경우에 대비해서 예외처리 코드를 추가했지만 이는 `Class#forName` 함수가 반드시 예외를 처리하게 하는(명시적 예외처리) 구조이므로 try-catch 문을 작성한 것이지 위 경우에서는 예외가 발생할 가능성이 없다.

본 문서에서는 [Java Annotation](http://en.wikipedia.org/wiki/Annotation#Java_annotations)의 문법에 대해 설명하는 것이 취지가 아니므로, 이 정도로 글을 마친다.