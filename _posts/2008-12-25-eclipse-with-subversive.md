---
layout: post
title: eclipse + subversive
tags: tool
---

eclipse는 우연히 만나서 같이 지내오는 녀석이고,
subversive는 알게 된지는 얼마 안됬는데 굉장히 많이 쓰게 된 녀석이다.

### eclipse ###

1학년 2학기 상상설계공학 수업에서 모바일 프로그래밍을 하였다. 이 때 J2ME로 진행하면서 `eclipse`를 처음 써보았다. 정확히 말하면 eclipse 3.2에 SK-VM 플러그인을 설치해서 작업했던 것이다.

아무튼 Java 언어나 문법보다 eclipse를 먼저 만났다 [...]

### subversive ###

svn은 2학년 여름 방학 때 동아리 선배님들과 아르바이트를 진행하면서 같이 일했던 선배에게 배워서 알게 되었다. *(그 때는 visual studio를 사용해서 visual svn을 썼었다.)*

그 후 마침 [마소](http://imaso.co.kr)에서 svn 관련 기사를 다루면서 `eclipse` 플러그인으로 `subversive`가 있다는 것을 소개해주었고, 이것을 2학년 2학기 인터넷 프로그래밍 수업 시간에 프로젝트를 진행하면서 주로 사용하게 되었다.

### eclipse ###

`eclipse`는 IBM에서 만든 통합 개발 환경(IDE)이다. 시작은 Java IDE로 시작한 것 같지만 요즘은 C/C++, Web, PHP, Modeling, Python, nesC 등등 별별 언어를 다 지원한다. *(FLEX builder도 eclipse 기반이다)*

보통 언어의 앞 글자를 따서 DT(Development Tookit)이라고 부른다. JDT, PDT(PHP), CDT라고 부르는 것들이 바로 이것이다.

하나의 `eclipse`에는 여러 DT가 포함될 수 있고 이것들은 내부에서 `perspective`라고 해서 나뉜다. 단 각 DT마다 eclipse 버전이 다를 수 있으므로 주의가 필요하다. *(이 글을 쓰는 시점을 기준으로 PDT는 아직도 eclipse 3.3을 못 벗어난 것 같다)*

아무튼 이 IDE를 쓰려면 일단 JRE(Java Runtime Environment)가 설치되어있어야 하고, 이건 [http://java.com](http://java.com)에 들어가서 받으면 된다. 벌써 jdk1.6.0_11이 나왔다.

이클립스는 [http://www.eclipse.org](http://www.eclipse.org)에서 다운받을 수 있다.

### subversive ###

subversive는 앞서 말했듯이 eclipse 내에서 svn 기능을 (정확히 말하면 svn client) 사용할 수 있게 해주는 플러그인이다. 기존의 subclipse가 좀 제대로 동작하지 않은 적이 있어서 나는 주로 subversive를 사용한다.

[http://www.polarion.org/index.php?page=download&project=subversive](http://www.polarion.org/index.php?page=download&project=subversive)

* eclipse에서 플러그인을 관리하는 곳은 3.4부터 update를 수행하는 곳과 완전히 통합되어버렸다.
재미있게도 그 메뉴는 help - software updates 이다.
* Software Updates and Add-ons라는 창이 뜬다. 여기서 새로운 것을 설치해야하니 Available Software Tab으로 이동한다.
* 그리고 Add Site를 눌러서 아래 두 사이트를 추가해주면 자신이 설치할 수 있는 목록을 가져와서 보여준다. 
	* http://download.eclipse.org/technology/subversive/0.7/update-site/
	* http://www.polarion.org/projects/subversive/download/eclipse/2.0/update-site/
* 거기서 뭐 적당히 알아서 깔면 된다. 나는 뭐, source 빼고 다 까는 편이다.
* SVN Connectors 깔고, SVN Team Provider 깔고, JavaHL이나 SVNKit를 선택해서 깔아주면 된다.

끝

### 요약 ###

Java 개발자를 위한 Subversive 플러그인 설치

* http://java.sun.com 들어가서 JDK 설치
* http://www.eclipse.org 들어가서 eclipse 다운로드
* eclipse 구동 후 Help - Software Updates 메뉴를 눌러 Available Software Tab로 이동한 다음 Add Site를 눌러
http://download.eclipse.org/technology/subversive/0.7/update-site/
http://www.polarion.org/projects/subversive/download/eclipse/2.0/update-site/
의 목록을 추가하고,
* SVN Connectors, SVN Team Provider, JavaHL or SVNKit (혹은 둘다) 선택해서 깔아주면 된다.


### 기타 ###

omega를 망쳐버린 내가 이런 말할 자격은 없지만,  
뭐랄까 wiki와 게시판의 중간 정도의 성향을 띄면서 뭐시기한 그런 게시판이 있으면 참 좋겠다. 하지만 웹 프로그래밍은 무서워서 섣불리 작업을 시작하기가 무섭다 [...]