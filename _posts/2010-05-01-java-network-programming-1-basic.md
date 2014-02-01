---
layout: post
title: 자바 네트워크 프로그래밍 1 - 기초
tags: java -pub
---

네트워크라는 것에 대해 깊게 설명할 생각은 없다. 단지 자바 언어에서 *어떻게 네트워크 프로그래밍을 할 수 있을까* 정도에 대해 간략하게 소개할 생각이다. 이 글을 보고 관심을 조금만 갖고 구글링해보시면 당연한 이야기이지만 훨씬 잘 설명된 좋은 글이 많을테니, 이 글에서 단순히 흥미유도 차원 글을 쓴다.

### 기초 ###

네트워크 프로그래밍은 두 원격지(HOST) 간의 데이터 통신을 위한 프로그래밍이다.
간단히 비유하자면,

1. 집에서 웹 페이지(서버)를 여는 것이나
2. 덕질을 위해 FTP에 접속하여 파일을 내려받거나
3. 과제를 위해 친구와 메신저로 대화를 하는

것 정도가 되겠다. 위의 상황을 네트워크의 원격지, 데이터로 구분해보면

1. 내 컴퓨터, 웹 서버, HTML 데이터 등
2. 내 컴퓨터, FTP서버, 애니메이션 데이터 등
3. 내 컴퓨터, 친구 컴퓨터, 대화(String) 데이터 등

이 될 수 있겠다.

통신을 한다는 건 두 HOST가 네트워크로<span style="color: #aaa;">(wired or wireless)</span> 연결되어있다는 것이다.  
네트워크에 속한 HOST는 그 특정 주소를 갖는데, 흔히 생각하는 `IP Address`라고 보면 되겠다. 흔히 우리는 네트워크를 사용하기 위해 TCP/IP Protocol을 사용하기 때문이다.  
[http://en.wikipedia.org/wiki/Transmission_Control_Protocol](http://en.wikipedia.org/wiki/Transmission_Control_Protocol)  
<span style="color: #aaa;">(다른 곳에 더욱 설명이 잘 있으니 자세한 설명은 생략한다)</span>  
<span style="color: #aaa;">(기계적 주소인 MAC Address와 함께 같이 찾아보면서 공부해보는 것도 좋다. 하지만 이 글은 자바 네트워크 프로그래밍이 주라서 이 부분은 제외)</span>

두 HOST가 서로의 주소를 안다고 해서 TCP/IP 통신할 수 있는 것은 아니다. TCP/IP 통신에는 `IP Address` 말고 `Port`라는 Unsigned Short Integer(16bit) 값이 하나 더 필요하기 때문이다.  
[http://en.wikipedia.org/wiki/TCP_and_UDP_port](http://en.wikipedia.org/wiki/TCP_and_UDP_port)

간단히 하나의 HOST 내에 실행되고 있는 수많은 네트워크 사용 프로그램들에 대해 데이터를 빠르고 명확하게 구분하기 위한 하나의 키 값이라고 보면 되겠다. **SSH는 22번, HTTP는 80번**과 같이 사실상 고유의 값으로 지정된 것고 있다.  
[http://en.wikipedia.org/wiki/TCP_and_UDP_port_numbers](http://en.wikipedia.org/wiki/TCP_and_UDP_port_numbers)

TCP/IP 프로토콜에서는 데이터를 보낼 때 **Packet**으로 쪼개어 보내는데 이 쪽을 공부해두면 장차 네트워크 프로그래밍할 때 도움되는게 많다.  
[http://en.wikipedia.org/wiki/Packet_(information_technology)](http://en.wikipedia.org/wiki/Packet_(information_technology))

### 서버와 클라이언트 ###

전화를 할 때도 거는 사람과 받는 사람이 있다. 전화라는 것은 

* 전화선으로 연결된<span style="color: #aaa;">(네트워크에 속한)</span>
* 두 사람<span style="color: #aaa;">(HOST)</span> 간에서
* 대화<span style="color: #aaa;">(데이터 통신)</span>을 하는 것

을 이야기한다.

이 때 거는 사람`(클라이언트)`은 받을 사람`(서버)`의 전화번호<span style="color: #aaa;">(IP Address와 Port)</span>를 눌러 전화를 걸고, 받을 사람`(서버)`은 전화가 걸려오기를 기다리고 있다가 전화가 오면 받는 것이다.

이것이 간략한 서버와 클라이언트의 개념이고, 자세한 내용은 다음 글에서 코드로 보면 되겠다.

### 결론 ###

TCP와 UDP의 특성, `IP Protocol`, `Packet` 등 네트워크 프로그래밍 기초라고 해도 들먹일 개념이 굉장히 많지만 그것들은 wiki 등 더욱 잘 나와있는 곳이나 동아리 사람들에게 질문해보시면 더욱 확실하게 배울 수 있고,  
**서버와 클라이언트의 개념, `IP Address`와 `Port` 번호가 무엇인지 정도만 알겠다 싶으면 된 것이다.**