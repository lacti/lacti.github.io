---
layout: post
title: MySQL INSERT
tags: database
---

요번에 만든 동아리 홈페이지의 채팅방은 `MySQL Memory Table`과 `Prototypejs`의 polling 기반이다.  
따라서 사용자가 꽤 접속하면 apache가 좀 힘들어할 수는 있지만, 그 양을 정량적으로 계산해봤을 때 크게 무리가 없다고 판단, 과도한 용도가 아닌 경우에서는 써도 괜찮겠다 싶어서 구현해놨다.

어차피 나중에 `부분 update`와 `websocket`으로만 치환해놓으면 되겠지.

그건 그렇고 MySQL의 `INSERT`문과 `UPDATE`문을 같이 쓰고 싶을 때,

* UPDATE를 먼저 시도하고 affected된 row의 수를 확인하거나
* query의 성공여부를 확인해서 INSERT를 썼는데,
 
이게 생각보다 잘 안된다.  
Memory Table이라서 그런건지 이유는 잘 모르겠는데 저 두 동작을 하나의 질의어로 합치고 싶었으나 내 지식선에서는 아는 바가 없었다.

그런데 찾아보니,

* http://dev.mysql.com/doc/refman/5.5/en/insert.html
* http://dev.mysql.com/doc/refman/5.5/en/insert-on-duplicate.html

`ON DUPLICATE KEY UPDATE`라는 재밌는 문법이 있다.


`INSERT`를 실패했는데 그 이유가 `DUPLICATE KEY`라면 `UPDATE`를 수행하라는 것이니, 이것을 사용하면 위 문제가 깔끔하게 해결된다.

역시 사람은 공부를 해야해 [...]  
조금 알고 있다고 reference를 찾아보지 않는 것은 좋지 않다. ~~그러고보니 SQL은 제대로 공부한 적이 없잖아?~~