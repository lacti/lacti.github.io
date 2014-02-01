---
layout: post
title: 분산 처리 환경 구현 1
tags: distributed c# -pub
---

잉여 컴퓨팅 자원을 십분 활용하여 처리량을 늘리기 위한 분산 처리 환경을 구축해보자.  
(hadoop, incredibuild 같은 프로그램을 만드려면 어떤 고민이 필요한지 생각해볼 수 있겠다.)

자세하게 파고들면 밑도 끝도 없을테니 간단하게 살펴보자.

분산 처리 환경을 구축할 때 적어도 다음의 항목에 대한 고민이 필요하다.

* 플랫폼은 무엇을 사용할 것인가?
* 언어는 무엇을 사용할 것인가?
* p2p로 만들 것인가, master-slave로 만들 것인가?


물론 더 고민할 것이 많겠지만 일단 위 정도만 고민해도 간단한 체계는 만들 수 있다.

다양한 플랫폼을 고려할 때

* jvm같이 밑단이 있는 녀석을 사용하거나 script 언어를 사용할 경우에는 native 언어를 사용할 때에 비해 target별로 cross-compile해줄 수고를 덜 수 있다는 장점이 있다.
* 반면 수행 속도가 중요할 경우에는 native 언어를 사용해야 할 수도 있다.

본 글에서는 **귀찮으니 windows, c#, master-slave로 작성하자.**

### master-slave 구조 ###

가장 간단한 master-slave 구조를 보면 다음과 같다.

![master-slave 구조]({{site.url}}/images/mdf_basic.png)

master는 여러 slave들을 관리하고, 실제 작업들은 slave가 처리한다고 보면 된다.
master는 작업 요청을 받아서, **적절히 쪼개서**, **적절히 slave에게 넘겨서 처리시키고**, **결과를 적절히 받아서 합친다**

즉, master는 job을 쪼개고(**map**), slave들을 잘 scheduling해서 처리시킨 결과를 받고, 그 결과를 취합한다(**reduce**). 분산 framework의 성능을 결정하는건 결국 얼마나 잘 쪼개고, 잘 스케쥴링 해주냐에 달렸다는 것이다.  
(물론 각 job이 어떤 특성을 지니냐에 따라서 최적화 방법은 천차만별일 것이다)

### 상태 정보 ###

master-slave는 job/result 이외에도 주고 받아야 할 정보가 있다. 대표적인 정보가 slave의 상태(state) 정보이다. master는 각 slave가 어떤 상태인지(on/off-line, cpu usage, memory/disk available, io scheduling 등) 잘 알고 있어야 job을 더욱 적절하게 분배하여 전체적인 성능을 높힐 수 있다.

이 때 slave가 주기적으로 master에게 해당 정보를 알려줘야 한다. (원격으로 slave의 상태를 가져갈 수 있도록 설정해도 되지만 논외로 친다.)

그런데 만약 result를 master가 취합할 필요가 없는 형태, 즉 function 형태의 job이 아닌 **action 형태의 job**일 경우에는 master가 굳이 slave와 connection을 유지할 필요가 없다. 이렇게 될 경우 master는 여러 connection을 관리하지 않아도 되기 때문에 복잡도가 현저히 줄게 된다.  
(분산 웹 크롤러를 예로 들 수 있다. master는 slave에게 수집할 url만 넘기고 slave는 master에게 결과를 전달하기 않고 db에 직접 저장할 수 있다.)

### sync with db 구조 ###

이 때 slave의 상태를 master에게 보고하기 위해 connection을 유지하거나 다시 connection을 맺는 것은 귀찮은 일이므로 다음과 같은 구조를 생각해볼 수 있다.

![sync-db 구조]({{site.url}}/images/mdf_sync_db.png)

slave들은 자신의 상태를 주기적으로 state db에 기록하고, master는 state db에 기록된 정보를 참고해서 slave에게 명령을 내린다. 이 경우 master는 slave와 connection을 유지할 필요가 없게 되고 이는 master의 구현 부담을 줄일 수 있을 뿐더러 connectivity가 좋지 않은 master-slave 환경에서 보다 유연하게 동작할 수 있다.

### slave + state-d 구조 ###

약간 다른 관점이지만 다음과 같은 모델도 생각해볼 수 있다.

![stated 구조]({{site.url}}/images/mdf_stated.png)

slave 프로그램이 해야할 일은 두 가지이다. master로부터 받은 job 처리와 master에게 state를 보고하는 것. 이 둘을 나눈 구조라고 생각하면 된다.

이 때 얻는 장점은 (간단한 구조에서는) 데이터의 방향성이 정해져서 프로그램 구현이 쉬워진다는 것이다.

* master는 state로부터 데이터를 받기만 하면 되고,
* slave는 master로부터 job을 받아서 처리만 하면 된다.

그리고 만에 하나 slave 프로그램이 오동작하여 사망할 경우 state가 이를 감지하여 master에게 보고할 수 있다. 그 후 상태에 따라 slave 프로그램을 다시 시작해줄 수 있다.
이러한 구조는 보다 견고한 분산 처리 환경을 구축하는데 도움이 될 것이다.

### 정리 ###

훨씬 더 다양한 방법이 있을테지만 생각나는 구조를 간략히 살펴봤고, 다음 글에서는 C#을 사용하여 간단한 분산 처리 환경을 구축하는 방법을 소개할 예정이다. 중요한 것은, **어떻게 job을 쪼개고, 분산시키고, 취합할 것인가** 이다.
