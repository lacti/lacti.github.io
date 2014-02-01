---
layout: post
title: HashSet과 ArrayList
tags: java
---

시간이 없으니 일단 짧게.

어떤 `equals`, `hashCode`가 구현된 `Entity object`를 `HashSet`에 추가한 뒤,
그 `object`에 대한 reference 변수를 사용하여 저 두 함수의 결과에 영향을 주는 field 값을 변경할 경우,

* `HashSet`은 contains가 false를 반환하는 반면,
* `ArrayList`는 contains에서 true를 반환함.

`ArrayList`는 전체 대상에 대해 `equals`를 수행하지만, `HashSet`은 `hashCode` 값을 가지고 검색을 하기 때문에 false가 반환된다.

```java
Entity entity = new Entity("lacti", "lactrious@gmail.com");

set.add (entity);
entity.setName ("choi");
set.contains (entity); // false

list.add (entity);
entity.setName ("choi");
list.contains (entity); // true
```
