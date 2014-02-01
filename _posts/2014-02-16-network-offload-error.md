---
layout: post
title: 네트워크 offload 장애
tags: network
---

최근 네트워크 장비 이상 현상으로 고생을 한 적이 있다. 패킷량이 특정 이상일 때 주기적으로 throughput이 감소하는 현상을 보였던 것이다. 플랫폼팀 팀장님께서 각고의 노력 끝에 원인을 찾아내셨다.

* Large Send offload V2
* TCP checksum offload

이 옵션이 왜 문제를 일으킬 수 있을까? 이에 대해 자세히 알아보자.

* [Windows Forum: 랜카드 옵션 Large Send Offload 가 궁금해요](http://windowsforum.kr/index.php?category=495009&document_srl=4479149&mid=qna)
* [TCP 체크섬 오프로드](http://myknowledge.kr/29)

원래 위 옵션은 cpu로 처리해야 하는 일을 nic가 대신 처리해서 전체 성능을 높여준다는 것이다. 그런데 테스트를 진행했던 네트워크에서는 서버 머신의 nic와 switch 간의 저 옵션이 제대로 동작하지 않아서 주기적으로 문제가 발생한 것이다. 서버 머신의 nic에서 해당 옵션을 끄니 더 이상 문제가 발생하지 않았다.

재미있는 것은, 위 옵션을 끌 경우 cpu에서 처리해야할 일이 늘어나니 cpu 사용량이 늘어나야할텐데 오히려 cpu 사용량이 줄어들었다는 점이다. 아마도 비정상 동작에 의해 packet이 drop되거나 해서 그걸 재전송하기 위해 cpu level까지 작업이 전파된 것으로 추측된다. 물론 정말 그런지는 windows logging 수준으로는 알 수 없으니 nic나 switch 로그를 봐야하는데 그렇게까지는 귀찮아서 안 봤다-_-

지난 번에는 nic driver의 버전 문제로 이런 현상이 있었고, 이번에는 nic와 switch의 호환 문제로 이런 문제가 발생하였다. 볼 때마다 SE는 참 힘든 일이구나 싶다. 이론 공부도 많이 필요한데 다양한 장애 상황에 대응할 수 있을만큼 많은 경험을 쌓아야 하니까-_-;