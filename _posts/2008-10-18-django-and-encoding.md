---
layout: post
title: django와 encoding
tags: database
---

mysql의 encoding은 참 여러 곳에 존재하기 때문에 종종 까먹곤 한다.  
table 자체의 collation과 field의 collation은 늘 인식하고 있는 존재이기는 한데, database 자체도 collation이 있다는 것을 깜빡한다.

이게 무슨 영향을 끼칠 수 있냐하면

* 구조적으로 database와 table, 그리고 field는 collation을 상속받는 구조이기 때문에
* table을 만들 때 collation을 명시하지 않으면 database의 collation을 상속받고,
* field 역시 table의 collation과 운명을 같이 하는 것이다.

django의 `Model class`는 db에 해당 객체를 tuple로 집어넣어주는 `save`란 method를 지원한다. 근데 한글 데이터를 넣는데 자꾸 뭐라뭐라 warning exception을 띄우는 것이다

코드를 백방으로 고치다가 안 되어서 이상해서 해당 table의 tuple 현황을 보니까 **이름과 nickname에 ???로 들어간 것이다**.

collation을 확인해보니 역시 `latin1_swedish`이다. 그래서 tuple은 들어가지만 제대로 안 들어가고 깨진다는 warning이 나오는 것이었다. 그런데 그걸 인지 못하고 unicode 문제인가 해서 unicode만 추가 삽질하고 있었다.

그래서 tabe을 다 제거하고 mysql 설정을 기본 utf-8로 바꾸고 다시 `syncdb`로 db에 table 추가했는데도, 또 이름이 ???로 들어가는 것이다. *보니까 아직도 latin1_swedish인 것!*

생각을 해보니, database 자체가 아직 `latin1_swedish`이어서 발생한 문제이다. 그래서 database drop해주고 다시 만드니까 아까 설정 바꾼게 적용되어 `utf8_general_ci`로 등록되었고 다시 `syncdb` 해주니까 이를 상속받아 다 잘 `utf8_general_ci`로 table 등이 작성되었다

......여기까지 대략 1시간 반 삽질

결국 문제는 django가 아니라 mysql이 문제였다는 것
