---
layout: post
title: java annotation과 reflection을 사용한 xml mapping
tags: java reflection -pub
---

마침 요즘 spring을 쓰면서 자바를 공부한다는 친구를 채팅방에서 만나게 되어 reflection과 annotation을 사용한 xml mapping에 대한 코드를 작성해보라고 이야기하였다. 그 친구가 언급한 DI와는 좀 다른 방향이지만, annotation을 사용한 metadata 사용과 reflection을 통한 설계적 유연성을 공부해보면 spring framework을 이해하는데 도움이 되지 않을까 하여 이야기했던 것이다.

annotation은 java에서 코드 내에 metadata를 넣기 위해 도입한 개념으로 1.5부터 추가되었다. 특정 지점(ElementType: Type, Method, Field, ...)에 특정 시점(Retention: Source, Class, Runtime)까지 유지되는 metadata 정보를 남길 수 있다.

reflection은 class나 method, field 등에 대한 type, signature 정보를 runtime에도 알 수 있도록 코드 구조 정보 등을 메모리에 올려서 접근 가능하게 해주는 기능으로 c/c++같은 native한 언어들을 제외한 대부분의 고급 언어에서 제공해주는 기능이다.

따라서 본 글에서는 model class에 적절한 annotation으로 어떻게 xml과 연결지을지에 대한 metadata를 기록하고, reflection으로 이를 적절히 읽어서 model과 xml의 상호 변환(mapping)하는 코드를 작성할 것이다.

먼저 model을 하나 만들자.

```java
public class Customer {
    public String name;
    public int age;
    public String order;
}
```

*(본 예제에서는 getter/setter의 필요성을 못 느끼므로 작성하지 않는다.)*

`Customer` class가 xml로 기록되어야 할 때에는 customer라는 노드 이름을 가져야할까? name이라는 field는 xml에 attribute로 기록되어야 할까? 아니면 child-element가 되어야할까? 그리고 그 이름은 꼭 name이어야 할까?

이러한 정보를 위 model class에 적절히 넣기 위한 가장 좋은 방법이 annotation을 사용하는 것이다.

class에 사용할 annotation을 정의한다(import 생략).

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface XmlClassBind {
    public String nodeName();
}
```

특정 `ElementType`이 TYPE이니 class에만 사용할 수 있는 annotation이고 그 정보를 `RUNTIME`까지 남긴다. 왜냐하면 해당 annotation 정보를 reflection으로 읽어서 runtime에 사용해야하기 때문이다. 그리고 `nodeName`이라는 annotation 값을 하나 같는데, 해당 class가 mapping될 xml element의 이름 정보를 넣기 위해 쓸 것이다.

이제 field에 사용할 annotation을 정의한다(import 생략).

```java
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface XmlAttrBind {
    public string nodeName();
    public boolean useAttribute();
}
```

`XmlClassBind`와 유사한데 `ElementType`을 `FIELD`로 선언하여 Field에만 사용할 수 있도록 한다. 그리고 `useAttribute`라는 boolean 속성을 추가하여 true이면 attribute로 기록하고 false이면 child-element를 만들도록 할 것이다.

이제 정의한 annotation으로 model class에 metadata를 넣어보자.

```java
@XmlClassBind(nodeName="customer")
public class Customer {
    @XmlAttrBind(nodeName="name", useAttribute=true)
    public String name;
    @XmlAttrBind(nodeName="age", useAttribute=true)
    public int age;
    @XmlAttrBind(nodeName="customer-order", useAttribute=false)
    public String order;

    /* default constructor, constructor for all of fields, toString method for debugging */
}
```

`Customer` class는 xml customer element에 대응될 것이고, `name`과 `age`는 attribute로 기록된다. `order` 문자열만 child element로 생성되는데 이 때 element 이름은 customer-order가 될 것이다.


모든 정보가 준비되었으니 이제 Xml과 mapping만 하면 되겠다. Java 기본 Xml Api를 사용하면 코드가 장황해지므로, 예전부터 사용하던 자체 구현 XmlElement을 사용하여 Bind를 수행하는 코드를 작성할 것이다.

먼저 model 객체들을 Xml로 변환하는 코드는 다음과 같다(예외 선언 생략).

```java
public static XmlElement ToXml(List<?> models) {
    if (models.isEmpty())
        throw new IllegalArgumentException();
    
    // get class type for first element
    Class<?> clazz = models.get(0).getClass();
    
    String classNodeName = clazz.getAnnotation(XmlClassBind.class).nodeName();
    String listNodeName = classNodeName + "-list";
    
    // convert model to xml-element
    XmlElement rootElement = new XmlElement(listNodeName);
    for (Object model: models) {
        XmlElement classElement = new XmlElement(classNodeName);
        
        // write fields
        for (Field field: clazz.getFields()) {
            XmlAttrBind attrBind = field.getAnnotation(XmlAttrBind.class);
            if (attrBind == null)
                continue;
            
            field.setAccessible(true);
            String stringValue = String.valueOf(field.get(model));
            
            // attribute or child-element
            if (attrBind.useAttribute()) {
                classElement.setAttribute(attrBind.nodeName(), stringValue);
                
            } else {
                XmlElement childElement = new XmlElement(attrBind.nodeName());
                childElement.setTextContent(stringValue);
                classElement.appendChild(childElement);
            }
        }
        rootElement.appendChild(classElement);
    }
    return rootElement;
}
```

model이 여럿 들어있는 List를 받아서 그것을 `XmlElement`로 변환해주는 코드이다. List 내에는 모두 동일한 type의 model 객체가 있다고 가정하였고, 해당 model class는 `XmlClassBind`와 `XmlAttrBind`가 적절히 선언되어있다고 가정하였다.

reflection으로 class의 `XmlClassBind` annotation 정보를 얻어서 class에 mapping 될 xml node 이름을 얻고, 그 집합에 대한 xml node 이름을 대충 -list 를 붙여서 쓴다.

그리고 모든 `XmlAttrBind`가 annotated된 field를 순회하면서 그 값을 `useAttribute`에 따라 attribute에 쓰거나 child-element에 기록한다. 다만 값을 가져오기 위한 Field가 private, default, protected 등 접근하지 못할 수 있으므로 `setAccessible()` 함수를 통해 접근 권한을 먼저 확보하고 접근한다.  
(따로 getter/setter 이름을 만들어서 `Method.Invoke()`로 접근하는 것보다는 이 편이 더 나아 보인다.)


`XmlElement`로부터 Model 객체를 생성하는 방식은 위와는 좀 다르다. 그 이유는 Model 객체에 대한 type 정보를 먼저 구해와야 하기 때문이다.

* class의 full name을 xml에 기록하여 Class.forName으로 해당 class에 대한 정보를 가져와서 사용하는 방법도 있고,
* 아래 예제처럼 Class<T> 자체를 인자로 받아서 구현할 수도 있다(예외 선언 생략).

```java
public static <T> List<T> ToModel(Class<T> clazz, XmlElement rootElement) {
    List<T> models = new ArrayList<T>();
    
    String classNodeName = clazz.getAnnotation(XmlClassBind.class).nodeName();
    for (XmlElement classElement: rootElement.findByTagName(classNodeName)) {
        // create new model instance
        T model = ReflectionHelper.newInstance(clazz);
        
        // fill fields' value
        for (Field field: clazz.getFields()) {
            XmlAttrBind attrBind = field.getAnnotation(XmlAttrBind.class);
            if (attrBind == null)
                continue;
            
            // get value from attribute or child-element
            String stringValue = null;
            if (attrBind.useAttribute()) {
                stringValue = classElement.getAttribute(attrBind.nodeName());
            } else {
                stringValue = classElement.getChildByTagName(
                        attrBind.nodeName()).getTextContent();
            }
            
            // parse and set value
            ReflectionHelper.setValue(model, field, stringValue);
        }
        models.add(model);
    }
    return models;
}
```

model class type 정보를 인자로 받아서, `XmlClassBind`에 명시된 xml element에 대해 model 객체를 만든 후 `XmlAttrBind`를 사용하여 field에 기록할 값을 찾아서 model 객체에 넣어준다. 결국 `ToXml()`의 역순이다.

이 과정에서 두 가지 주의할 점이 있는데 `ReflectionHelper.newInstance()`를 수행하는 부분과, `ReflectionHelper.setValue()`를 수행하는 부분이다.


`newInstance()`를 사용하여 model class의 객체를 만들 때 해당 class에 default constructor가 정의되어있지 않으면 생성할 수가 없다. 때문에 bean class들은 기본 생성자만 정의하고 field를 초기화하는 paramter를 갖는 생성자를 안 만드는 경향이 있다.

그런데 POJO를 사용하다보면 기본 생성자를 놓치는 경우가 있는데, 그럴 경우 reflection을 사용하더라도 호출할 적절한 생성자를 찾기가 힘드므로 생성하기가 좀 곤란해진다.

```java
public class Customer {
    public String name;
    public int age;
    public Customer(String name, int age) { /* ... */ }
    /* there is no default constructor! */
}
```

위와 같은 `Customer` class는 reflection으로 생성한다고 해도 constructor의 signature가 init (String, int) 형태가 되므로, 인자를 받지 않는 생성자를 호출할 수가 없다. 따라서 이런 구조에서는 원치 않더라도 기본 생성자를 만들어주어야 하고, 정말 원치 않는다면 기본 생성자를 만들고 private이나 default로 선언하게 된다. (private으로 선언하면 안 불린다고 필요없는 코드로 자바 컴파일러가 경고를 낸다.)

`Class.newInstance()` 함수는 기본 생성자가 있고, 해당 생성자가 접근 가능(public)할 때만 사용할 수 있는 함수이다. 따라서 외부에서 접근할 수 없는 private, default, protected로 선언한 기본 생성자가 있다면 문제가 될 수 있다.

이를 고려하여 `ReflectionHelper.newInstance()` 함수를 작성하면 다음과 같다. (예외 선언 생략)

```java
public static <T> T newInstance(Class<T> clazz) {
    Constructor<T> defaultConstructor = clazz.getConstructor();
    defaultConstructor.setAccessible(true);
    return defaultConstructor.newInstance();
}
```

즉, defaultConstructor를 가져오고, 그것에 대한 접근 권한을 주고(`setAccessible()`) 해당 생성자로 `newInstance()` 를 호출해야 한다는 것이다.


값을 Field의 type에 맞게 적절히 parsing해서 넣어주는 `ReflectionHelper.setValue()` 함수는 우아하지 못하다. 그냥 Field의 type을 case by case로 검사해서 값을 직접 넣어주는 방법 밖에 없다.  
간단하게 int, String에 대해서만 구현을 해보면 다음과 같다. (예외 선언 생략)

```java
public static void setValue(Object target, Field field, String value) {
    Class<?> fieldType = field.getType();
    field.setAccessible(true);
    if (fieldType.equals(int.class) || fieldType.equals(Integer.class)) {
        field.set(target, Integer.parseInt(value));
        
    } else if (fieldType.equals(String.class)) {
        field.set(target, value);
        
    } else throw new IllegalArgumentException("type doesn't support!");
}
```

field의 type을 가져온다. 그리고 접근 권한을 준 다음에, fieldType에 대해 하나씩 비교하면서 각 type에 맞게 parsing하여 넣어준다. primitive type의 경우 wrapper type도 있어서 처리가 좀 귀찮은데, 위처럼 각 쌍으로 묶어서 처리해주면 좀 낫다. map 같은 것을 써서 type별로 어떻게 처리할지 보다 깔끔하게 등록할 수도 있겠지만, 결국 최종 코드는 거기서 거기인 듯 싶다.

요약하면, field에 대한 type 정보는 reflection을 사용하여 class로부터 가져올 수 있으므로 따로 xml 등에 기록할 필요는 없다는 것이다. 따라서 그 정보를 보고 type에 맞게 값을 적절히 넣어주면 된다.


여기까지해서 간략하게 annotation을 사용하여 xml과 java model을 bind하는 코드를 작성해 보았다.
하고 싶었던 이야기는 코드 자체에 annotation을 사용하여 어떤 수행을 해야하는지에 대한 추가 정보를 metadata로 기록하여 좀 더 유연하고 확장성 있는 프로그래밍을 해볼 수 있다는 것이다.

* 만약 model class에 대해서 xml 뿐만 아니라 SQL에 대해서도 binding을 해야한다면?
* SQL의 각 table과 column에 대해 bind하기 위한 annotation을 작성하고,

그에 대한 적절한 bind helper class를 작성하면 되겠다.
(이왕 작성하는 김에 xml binder와 sql binder의 interface를 맞춰서 보다 유연한 설계를 해볼 수도 있겠다.)

* 만약 해당 model을 network로 전송하기 위해 적절히 string serialize, deserialize를 해야한다면?

역시 이에 대한 metadata 정보를 annotation 등으로 기술하고 적절한 bind helper를 구현하여 사용할 수 있을 것이다. 그리고 이렇게 구현한 bind helper, binding annotation은 추후 다른 application을 개발할 때에도 유용하게 사용할 수 있을 것이다.


annotation, reflection 관련하여 혹시 다른 예제를 보고 싶으면 아래의 링크를 참고하면 된다.

* [java annotation을 사용한 InstanceId 구현](% post_url 2011-03-02-implementation-instance-id-with-java-annotation %})
* [reflection을 사용한 간단한 Message 체계 구현](% post_url 2011-11-27-java-message-dispatcher %})