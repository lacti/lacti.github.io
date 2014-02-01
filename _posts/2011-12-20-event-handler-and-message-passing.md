---
layout: post
title: EventHandler와 Message Passing
tags: java message -pub
---

객체(object)는 상태(state)를 갖고 외부의 조작(mutator)에 의해서 변경될 수 있다.
이러한 객체를 다루는 프로그래밍을 할 때는, 관찰자(observer)가 객체의 상태 변화(property change)를 감지하여 어떠한 동작(action)을 수행하는 경우가 많이 있다.

이러한 코드를 작성할 경우, 관찰 당하는 객체(subject)와 관찰자(observer)의 관계를 어떻게 정의하냐에 따라서, 확장성, 결합성 등이 많이 달라지게 된다. 이 글에서는 간단한 EventHandler와 Message Passing에 대해서 다루어보려고 한다.  
[http://en.wikipedia.org/wiki/Observer_pattern](http://en.wikipedia.org/wiki/Observer_pattern)

### hard binding ###

명부(List)는 내부에 사람(Person)을 포함한다. 사람은 이름(name)이라는 속성(property)을 갖고, 이 값은 외부에서 변경될 수 있다(mutator method). 명부는 사람의 이름이 변경되는 것을 감지해야한다.

이를 위한 가장 간단한 방법은 아래와 같다.

```java
class Person {
    private List observer;
    private String name;
    public Person() {}
    public String setName(String name) {
        observer.nameChanged(this.name, name);
        this.name = name;
    }
    public void attach(List observer) {
        this.observer = observer;
    }
}
class List {
    public void add(Person person) {
        person.attach(this);
    }
    public void nameChanged(String oldName, String newName) {
    }
}
```

간단한 구조에서는 위와 같이 하는 것이 더 직관적일 수 있다. 하지만 Person과 List는 강결합되고, 추후에 Person 객체의 name 값이 변경되는 것을 감지하려는 대상(observer)이 늘어날 수록 코드는 복잡해질 것이다.

### interface 도입 ###

두 객체 간의 강결합을 피하기 위해 이를 분리하기 위한 중간 interface를 도입한다.

```java
interface NameObserver {
    public void nameChanged(String oldName, String newName);
}
```

이제 Person과 List의 관계는 NameObserver를 통해서 약간은 분리되었다.

```java
class Person {
    NameObserver observer;
    public void attach(NameObserver observer) {
        this.observer = observer;
    }
}
class List implements NameObserver {
}
```

`Person`은 자신의 이름이 변경될 때 그 사실을 알려주어야 할 대상을 `NameObserver`로 한정지을 수 있다. 즉, `NameObserver`를 구현하는(implements) 모든 대상들은 `Person`의 `name` 변경에 대한 고지(notify)를 받을 수 있는 것이다.

### multiple observer ###

하나의 `Person`이 여러 `NameObserver`에게 사실을 알려주어야 한다면, `NameObserver` 객체에 대한 reference를 Collection 형태로 가지고 있으면 된다.

```java
class Person {
    List<NameObserver> observers = new ArrayList<NameObserver>();
    public void attach(NameObserver observer) {
        this.observers.add(observer);
    }
    public void setName(String newName) {
        for (NameObserver each: this.observers) {
            each.nameChanged(this.name, newName);
        }
        this.name = newName;
    }
}
```

위 같은 작업은 속성(property)를 갖는 많은 JavaBean 객체에서 주로 사용되므로, Java 쪽에서는 `PropertyChangeSupport`라는 Utility class를 통해 위 작업을 편하게 구현할 수 있게 해준다.

### PropertyChangeEvent ###

interface 쪽으로 분리되었다고 해도, `Person`의 변경에 대해 통지해야할 속성 값의 개수가 늘어나거나, 그 내용이 변경되거나 하면 이 interface의 수정은 불가피하다.

예를 들어, `Person` class에 나이(age)속성이 추가된다고 하자.

```java
class Person {
    private String name;
    private int age;
}
```

그리고 `age`에 대해서도 변경 통지를 해주고 싶다. 그러면 `AgeObserver`를 하나 새로 만들어야 할까? 아니면 `NameObserver`를 적절히 `PersonObserver`로 변경한 다음 `ageChanged`라는 함수를 추가해줄까? 이전에 `NameObserver`를 구현(implements)하고 있던 class들이 모두 `age`에 대한 변경 통지를 원할까?

즉, 중간 interface 분리를 통해 `Person`과 `List` class의 결합도는 낮아졌지만, `Person`과 `NameObserver`, `NameObserver`와 `List`의 결합은 상속(Java 에서는 interface 에 의한 구현implements 이지만 runtime에 변경될 수 없는 정적 binding 이라는 점에서는 매한가지다) 관계이므로 이쪽은 여전히 강결합이라는 것이다.

이 문제를 해결하기 위해서는 약간의 추상화가 더 필요하다.
`Person` class는 자신의 상태(속성)가 변화될 때의 정보를 적절히 capsulation하여 객체로 구성하고, 이를 통지받는 쪽에서는 그 정보 객체를 받아 적절히 처리하는 것이다.

즉, 정보를 담기 위한 중간 객체가 등장한다.

```java
class PropertyChangeEvent {
    String propertyName;
    Object oldValue;
    Object newValue;
}
interface PropertyListener {
    public void propertyChanged(PropertyChangeEvent event);
}
```

이제 `Person`은 자신의 정보가 변경될 때마다 `PropertyChangeEvent` 객체를 자신에게 등록되어있는(subscribe) `PropertyListener` 객체들에게 던진다. 그러면 그 `PropertyListener`의 구현체들은(implements or concrete) `PropertyChangeEvent` 객체를 받았을 때 자신이 원하는 이벤트에 대해서만 처리하는 것이다.

```java
class Person {
    List<PropertyChangeListener> listeners = new ArrayList<>();
    public void setName(String newName) {
        for (PropertyChangeListener each: listeners) {
            each.propertyChanged(new PropertyChangedEvent("name", this.name, newName));
        }
        this.name = newName;
    }
```

```java
class List implements PropertyChangeListener {
    public void propertyChanged(PropertyChangeEvent event) {
        if (event.propertyName.equals("name") {
            // name changed
```

실제로 위 방법의 `PropertyChageEvent`는 너무 일반적(generic) 해서 정보를 가져올 때 썩 좋지는 않다. 어떤 속성 값이 바뀌었는지 String 변수를 통해 판단하므로 판단에 위험도 있고, 그 값도 모두 Object이므로 type-cast 위험도 있다.

이를 해결해주기 위해서 적절히 `Event` class 를 분화한다던지, `Event`의 각 Id 값을 enum이나 int 등으로 분류하여 관리한다던지 한다.

그리고 위 경우에도 자신이 관심있는 속성에 대해서만 `PropertyChangeEvent`를 받는 것이 아니라 모든 변경에 대해 받게 된다. 이 역시 `Person` class (사실상 Model 객체)에 `Listener`를 attach 할 때 어떤 속성에 대한 변화 통지를 받을 것인지를 따로 관리하게 하는 방법으로 해결할 수 있다.
(하지만 더 이상의 자세한 설명은 생략한다.)

또한 Reflection 등을 사용하여 각 Event type마다 다른 Handler를 호출되게 하는 방법도 있다. [간단한 Message 체계 구현]({% post_url 2011-11-27-java-message-dispatcher %})


요약하자면 결국 송신/수신 객체간의 낮은 결합성을 고려한 상태 변화 통지의 설계가 Event Handler (Listener) 방식이라는 것이다.

### message passing ###

Message Passing이야기를 해보자.
Event와 Message는 정보를 담은 객체이면서, 송신/수신 객체의 의존성을 분리하기 위한 추상화 방법이라는 점에서 매우 유사해보인다. 그런데 억지로 가장 큰 차이를 들어보자면,

* Event는 Event 발생자와 수신자(Listener) 간의 1:N 관계 (Event 발생자가 여러 수신자에게 Event 객체를 넘겨주는 식)이고,
* Message는 여러 Message 수신자(Listener)가 Message 생성자와 MessageQueue를 공유해서 N:M 의 처리가 이루어지는 구조이다.

*(너무 억지다)*

사실상 Java에서도 UI Event에서 처리 동기화를 위해 단일화된 EventQueue를 쓰고, 이를 처리하는 Event Dispatch Thread (EDT)가 EventQueue에 들어있는 Event를 하나씩 꺼내서 처리한다.

즉, UI Components들은 자신들에게서 일어나는 일에 대한 처리를 **위임**하기 위해 그 정보를 Event 객체에 담아 EventQueue에 넣고, EDT는 그걸 하나씩 꺼내서 자신에게 등록된 Listener들을 하나씩 불러서 처리할 수 있게 해주는 것이다.

Event, Message, Signal 개념적으로 모두 자신의 할 일을 남에게 위임(delegation) 하는 상황에서 객체간의 결합성을 낮추기 위해서 사용되는 개념이고, 안에 들어있는 정보가 작을 수록 Event에서 Signal 쪽으로 부르는 것 같기는 하지만 보면 그냥 각자의 취향같다.
