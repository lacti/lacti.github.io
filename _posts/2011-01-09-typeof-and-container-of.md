---
layout: post
title: typeof, container_of
tags: c
---

gcc의 additional standard?라고 하는데 generics를 지원하기 위한 도구가 만능 void * 이외에 이런 것도 있었다.  
[typeof](http://gcc.gnu.org/onlinedocs/gcc/Typeof.html)

어떤 struct 내부 변수의 주소와 그 struct의 typename을 알 때, struct 변수의 시작 주소를 알아내는 [`container_of`](http://forum.falinux.com/zbxe/?document_srl=531954)라는 매크로에 대해 동아리 친구와 잠깐 이야기했던 적이 있다.

간단히 설명하면 `((type *) NULL)->var`는 분명히 access violation이 나겠지만, 주소를 얻어내는 `&` 연산자가 붙으면
컴파일러에서 실행 전(!)에 주소 값을 구해주기 때문에 `&((type *) NULL)->var`는 해당 struct 변수에서 멤버 변수의 주소가 얼마나 떨어져있나를 알 수 있게 된다.

해당 멤버 변수의 주소를 알게 되면, 덕분에 저 "떨어진 길이"를 역으로 빼서 struct 변수의 주소를 구할 수 있다.