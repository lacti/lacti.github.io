---
layout: post
title: java remotelib 개발
tags: java rpc -pub
---

심심한 상황에서 뭘 코딩할까 고민중에 java rmi app를 만들다가 고생한 기억이 있어서 이걸 좀 쉽게 사용할 수 있는 remote lib를 만들어보자는 생각에 시작하였다.

### 개발 목표 ###

1. 기존의 java rmi와 유사한 code로 remote method interface call을 구현할 수 있어야하고,
2. 쌍방통신이 쉽게 가능했으면 한다.  
   ※ rmi는 보안상의 이유로 단방향을 기본적으로 지원하는데, 보통 클라이언트에서 서버의 함수를 호출하는 방식이다.  
   서버에서 클라이언트의 함수를 호출하려면 약간 설정해줘야하는게 더 있고, 실행하기가 귀찮아진다-_-
3. 또한 기본 socket을 이용하여 방화벽 혹은 가상ip로 인한 rmi binding 문제가 안 일어났으면 좋겠고,
4. 가능하다면 socket proxy를 사용해서 뭐가 날라가는지도 가려보고 싶고
5. 80 port를 이용, http message로 둔갑하여 netcare같이 packet 내용까지 보는 녀석에게도 안 걸렸으면 좋겠고,
6. c, c++ 등의 다른 언어와도 통신이 가능했으면 좋겠다.
7. server는 효율적이고 scalable하면 좋겠다.

### 구현 ###

#### 기본 골격, object-portage ####

1. 기본 java socket를 이용하여 서버와 클라이언트 간의 data 통신이 가능한 socket을 얻는다.
2. 이 socket의 stream에 objectstream을 끼워 쌍방에서 object를 주고 받을 수 있도록 한다.
3. 서버와 클라이언트가 object를 주고 받는다.
4. 이 때 각 socket에 대하여

#### 요청/분기/반환, request/response dispatcher ####

1. 서버와 클라이언트가 주고 받는 메시지 객체(object)를 class화 하여 주고 받는다.
2. 보내는 쪽(sender)는 상대방(receiver)에게 메시지(message)를 보내고(request) 답변(response)이 올 때까지 기다린다(wait)
3. 받는 쪽(receiver)는 상대방(sender)이 보낸(request) 메시지(message)를 적절한 함수가 처리(process)하게 한 뒤, 그 결과를 상대방에게 보낸다(send, response)
4. 기다리고 있던 보낸 쪽(sender)의 receiving thread는 아까 요청한 메시지에 대한 답변(response)를 받으면, wait하고 있던 send thread에 notify를 해서 lock을 풀어준다. 그리고 받은 response message를 반환받게 한다.

```java
// send part (pseudo)
stream.send(message);
lock.wait();
return responseMap.get(message.getId());

// receive part (pseudo)
message = stream.receive();
responseMap.put(message.getId(), message);
responseLock.get(message.getId()).notify();
```

#### 함수 호출 메시지, function call message ####

1. 함수 호출을 위한 정보(함수 이름, 함수 인자 타입parameters' type, 함수 인자arguments)를 담는 call message class 작성
2. 함수 반환 값 전달 위한 return message class 작성
3. 수행 도중 예외 담을 exception message class 작성

#### 원격객체 연결/호출, binding and call remote-object ####

1. 제공할 함수에 대한 interface class 작성
2. 제공할 곳(server) 해당 interface를 구현하는 원격객체 작성, 이름(bindname) 부여, map에 등록(여러 원격객체 연결binding 가능)
3. 호출할 곳(client) 해당 interface에 대한 proxy instance 생성, method가 실행될 때 지정된 bindname과 호출한 method 정보를 call message(2-3)로 만들어서 server로 전달
4. call message를 받은 server는 bindname으로 binding된 remote-object를 가져와서 reflection으로 해당 method을 invoke함
5. 그 결과값을 return message에 담아 client에게 전송
6. client에서는 호출한 call message에 대한 return message가 올 때까지 대기(wait, 2-2)

#### 호출 간 xml message 사용 ####

1. 기존의 방법은 java의 objectstream을 사용하였기 때문에 c, c++ 등과 통신 불가능. 따라서 `javax.beans.XMLEncoder`/`XMLDecoder`을 사용

#### http message로 위장 ####

1. `HTTP Header`를 붙임.
2. 받는 쪽에서 위와 같은 메시지를 받아서 header는 무시하고 body의 xml을 이용, remote message로 사용
3. 하지만 `XMLEncoder`/`XMLDecoder`는 serializable할 class의 기본생성자가 필수여야하고, 딱히 그에 대응되는 다른 언어(c or c++) library가 안 보여서 그냥 `XMLEncoder`, `XMLDecoder`를 만드는게 낫지 않을까 고민중(recursive한 object에 대한 serializing 문제를 해결 못함)
 
```http
POST remote HTTP/1.1
Content-Type: xml
Content-Length: 1123

<?xml...
```

#### http message compaction ####

1. ZipStream을 이용, http body message 부분의 data를 plain/text가 아닌 zip data로 보냄. data 전송량을 줄일 수 있음

#### 타언어와의 통신 ####

1. c 계열의 통신을 가정했을 경우, 먼저 code generator를 통해 주고받을 argument들의 대응 객체 생성. 즉 java에서 작성한 bean에 대응되는 c의 구조체를 작성해야함.
2. c 계열의 xml-decoder에서 해당 구조체에 값을 올바른 순서로 넣기 위한 RTTI에 버금가는 정보/순서를 구현해야함
3. String, List 등 java에서 제공하는 기초 api를 c/c++로 converting하는 library 제작
4. 한글 등 unicode/multibyte 문자를 적절히 변환해주는 charset library 제작-_-(힘들다)

#### 고가용서버 ####

1. SelectableChannel과 Selector을 이용, server단 thread 개수 감소를 통한 프로그램 효율 증가
2. ByteBuffer 등 nio를 이용한 stream 성능 향상
3. ByteBufferPool, ThreadPool을 이용한 객체 재사용

### 현재 상황 ###

일단 object-stream을 이용한 remote lib 구현 완료, 주석까지 달아서 지금 올리는 중.  
성능 개선이 절실히 필요한데, 일단 오늘은 시간이 없으니 여기까지만-_-