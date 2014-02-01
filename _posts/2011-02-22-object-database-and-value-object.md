---
layout: post
title: Object Database와 Value Object
tags: design database -pub
---

프로그램이 Client, Server의 2-tier 모델에서 Server가 Data의 persistence를 위해 database를 사용한다. 이 때 client가 요청한 정보를 server가 database로부터 반환받아 client에게 넘겨주는 framework를 작성해보자.

### 설계 1 ###

일단 Client와 Server가 주고 받을 데이터를 담는 객체를 설계한다.
기본(primitive) type과 String, Date 등의 간단한 정보를 속성(멤버 변수)로 갖는 JavaBean 객체를 설계한다.

### 설계 2 ###

Client의 요청에 대해 Server가 Database로 Query를 날려서 그 결과를 JavaBean 객체에 남아서 Client로 반환한다.

### 설계 3 ###

여러 프로그램을 작성하는 과정에서 Database Table에 대해 데이터를 삽입(Insert)하거나 갱신(Update)하는 등의 경우에서 유사한 코드가 자주 중복된다. 이러한 부분을 Framework으로 묶고자 Object 기반의 Database Adapter를 설계한다.

Database Table에 대응되는 객체를 설계(class)하고,
각 객체에 대해 Database Adapter의 CRUD(Insert, Select, Update, Delete)를 수행할 때 객체 내부의 Member 정보를 Reflection을 통해 접근해서 Query를 자동으로 생성할 수 있도록 한다.

이러한 Database Adapter를 통해서 굉장히 간단한 방법으로, 객체 기반의 Database 접근이 가능해진다.

```java
Database db = new MySQLDatabase();
db.insert(new Person("lacti", "poolc"));
Person p = new Person("lacti");
db.read(p);
db.delete(p);
```

### 문제점 ###

해당 Database Adapter는 Relation Database를 Object Database로 adapting해버리므로 JOIN 등의 Select query를 처리할만한 좋은 방법이 없다. 즉, 객체 단위의 데이터베이스 작업에 대해서는 간단한 작업을 보장하지만 각 Table의 Relation을 고려해야할 경우에 문제가 생긴다.

또한, 특정 값을 Update하거나, Where 조건이 복잡해지거나, 특정 항목만 Select할 경우에 대해서는 설계적으로 명확히 제공해주지 않기 때문에 구현이 복잡해지거나 자원 낭비가 발생한다.

### 문제점 원인 분석 ###

본 모델은 Mysql J/Connector의 QueryAdapter를 기반으로 설계된 모델로, Query를 직접 작성하지 않고 객체의 class 정보를 reflection으로 읽어서 자동으로 Query를 구성해주어 작업의 편의를 도모하고자 설계한 것이다.

그렇기 때문에 Query를 직접 구성해야하는 경우에는 이러한 모델이 적합하지 않다.

따라서 위의 Object Database Adapter는 MySQL 등의 RDB에 붙여서 사용하는 것보다는 테스트를 위해 Memory Model을 사용할 때 더 적합하며, Relation이 적게 고려되는 간단한 Database 프로그래밍을 해야할 때 사용될 수 있겠다.

### 문제점 해결 ###

이러한 Adapter를 통해 Query를 직접 작성하지 않고 Database로부터의 결합을 분리시키기 위해서는, Query를 Modeling하여 이에 대해 각 Database별 구현을 가질 수 있도록 한다.

하지만 이러한 경우를 고려하기에는 부담이 크므로 이에 대해서는 본 설계에서는 단순히 MySQL을 사용한다고 가정한다.

* 물론 이렇게 될 경우 Test 코드를 작성해도 MySQL에서 돌려야하는 문제점이 있으므로 좋지 않다.
* Test 용 데이터베이스를 따로 관리해야할 수도 있다.
* 물론 ror 등에서는 이를 위해 Test 용 데이터베이스를 생성해주는 기능이 있는데 이는 다음에 다루어보자

jdbc를 사용하여 MySQL에 접속하여 Connection 객체를 얻을 것이다.
인자의 안정성 보장을 위해 PreparedStatement 객체를 생성한 후 직접 작성한 Query를 통해 결과를 ResultSet으로 받아온다.

이 때,

1. 결과를 담는 객체를 Generalize하기 위해서 Map 형태의 결과 담기 객체를 사용할 수 있다.
2. 결과를 명시적으로 담는 객체를 각 결과에 대응하여 생성한다.

1)로 설계할 경우 훨씬 유연하고(어차피 내부에서 String 등으로 각 값에 접근할테니 오류가 나서 죽는 경우는 있어도 Database 모델이 변경된다고 해도 class가 바뀔 일은 없다) 위험성을 갖는다.  
2)로 설계할 경우 1)에 비해 유연성은 다소 떨어지고 작업량이 증가하겠지만 훨씬 안전한 프로그래밍이 가능하다.

이에 대해서 본인의 생각을 이야기하자면,  
당연히 2)의 설계 방향으로 진행하되, 2)에서 이야기하는 "결과를 담을 객체"의 설계는 굉장히 기계적인 프로그래밍이 될 수 있으므로 이에 대해서는 code를 generating하는 방식을 사용하는게 어떨까 싶다.

아무튼 이러한 객체를 `ValueObject`라고 해서 DAO 패턴에서 볼 수 있게 된다. 따라서 Server는 Client의 요청에 대해 Database에 필요한 정보를 요청하여 그 정보를 담는 VO 객체를 반환하면 된다.

### 결론 ###

프로그래밍을 함에 있어 Data의 Persistence를 고려하지 않는 프로그램은 없을 정도로 이는 기본 요소라고 할 수 있겠다. 하지만 프로그램에서 어떤 수준을 요구하냐에 따라서 그에 적합한 설계를 해야할 것이고,

가장 중요한 것은 어느 특정 하나에 지나치게 결합되어 분리되지 않는 경우에는 나중에 크게 당할 수 있으니 이에 대한 고려를 하면서 프로그래밍을 진행하는 것이다. 간단한 방법으로 Test Code를 작성하기 용이한 설계인가? 정도를 고려해봐도 괜찮겠다.

간단한 Object 기반의 Database와 복잡한 Query 기반의 Database 모두 자주 사용되는 것으로 이에 대한 공통된 interface를 갖는 framework를 설계하고 싶지만 간단한 일이 아니다.

따라서 본 문서에서는 간단히 각 경우에 대해 적합한 설계를 하자는 흐지부지한 결론을 내렸다. 물론 C#의 DataSource, DataTable, DataAdapter 개념, LINQ 등을 잘 고려해보면 만들고자 하는 framework을 못 만들 것도 없겠지만, 과연 *간단히* 만들 수 있을까 싶다.

해당 사항은 나중에 논의해보자.