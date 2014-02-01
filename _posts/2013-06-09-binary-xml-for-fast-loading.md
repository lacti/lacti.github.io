---
layout: post
title: xml 기반의 데이터시트 빨리 읽기
tags: optimization data -pub
---

지금 일하고 있는 회사에서는 모든 게임 데이터를 xml로 기술하고 있다. 서버가 시작할 때 읽게 되는 xml의 양만 본다면 대략 800~900MB로 엄청난 양을 읽어야 한다. 덕분에 서버가 저 모든 데이터시트를 읽어서 메모리에 올리는 시간만 약 4~5분이 소요가 되었고, 이 시간으로 인해 발생하는 비효율은 말할 필요가 없을 정도였다.

본 글에서는 이 문제를 해결하기 위해 어떠한 탐색 과정을 거쳤으며 결과적으로 문제를 어떻게 해결하였는지 서술하려고 한다.

### profiling ###

xml parser로 expat을 사용하고 있는데 이는 SAX parser이다. 문제는 SAX 이벤트를 받아서 STL의 자료구조에 넣고 그걸 iterating하는 방법으로 사용하고 있었다는 것이다. 대충 추측하고 있는 성능 저하 요소가 몇가지 있었지만 문제를 정확히 분석하기 위해 해당 서버 바이너리를 VS2010의 profiler로 수행한 결과를 확인했다.

1. XML Parsing
2. XML Model에 parsing한 결과 담기 (STL)
3. XML 파일 접근에 의한 IO

위 세 가지 요소가 가장 시간을 많이 잡아먹는 것으로 확인 되었다.

재미있는 것은 2번 항목이다.

* Profiling을 돌리기 전 여러 방법으로 실험을 하는 과정에서 발견된 것인데, Debug 버전으로 작성한 서버와 Release 버전으로 작성한 서버의 시간이 크게 차이가 나고 있는 것이었다.
* Debug와 Release에서 1) 항목과 3) 항목이 큰 차이를 보이지 않을 것이라고 판단했기 때문에 2) 항목이 꽤 큰 이유를 차지하지 않을가 생각했던 것이었는데, profiling 결과 그 값이 생각보다는 그리 크게 나오지는 않았다. (관련 내용 후술함)

### binary xml ###

위 문제를 해결하기 위해서 다음과 같은 접근 방법을 사용했다.  
xml parsing 시간이 오래 걸리니 이를 해결하려면 parsing을 하지 않아야한다. 그러기 위해서 xml을 parsing한 결과를 binary로 serialize해두었다. 이 때 모든 xml을 다 serialize하면 용량이 크기 때문에 서버에서만 읽는 데이터만 내보냈다.  
(데이터시트에는 서버, 클라이언트, 툴, 기타 디자이너 참고용[...]으로 데이터가 기술되어 있기 때문에 서버에서 필요로하는 데이터만 추리면 약 600MB까지 양이 줄어든다)

binary로 serialize하기 위해 만든 파일의 구조를 간단히 보면 다음과 같다.

![internal structure]({{site.url}}/images/binary_xml_each.png)

위 그림은 하나의 xml 파일에 해당하는 정보를 갖는다. 먼저 한 파일에 대한 `header 정보` - 파일 길이, 이름, 최종 수정 시각을 갖는다. (최종 수정 시각이 필요한 이유는 이 글 마지막 부분에 설명하겠다.) 그리고 `XmlData` 영역에 `Node`와 `Attribute`를 차례대로 기록하게 된다.

이 때 `NodeIndex`와 `AttributeIndex`는 `XmlTypeDefine`이라는 Xml 문법 정의 파일을 참고해서 작성된다. 예를 들어 Skill이라는 Node가 XmlTypeDefine에서 3번째에 정의되었다면 NodeIndex는 3이 되는 것이다.

그 외에 Node의 특성에 다른 정보가 추가 bit로 구성된 것들이 있다. `text`는 XmlText를 포함할 경우 set되는 bit이고, `Recursive`는 말 그대로 Node의 구조가 recursive할 때 사용되는 bit이다. 단순히 자신의 TypeDefine 정보를 부모의 자식 정보 중 NodeIndex 번째의 것을 사용하는 것이 아니라, 부모의 것을 그대로 사용(Recursive하니까)하는 구조라는 뜻이다.

궁금해할 사람은 없어보이지만 string이나 list-type은 다음과 같이 serialize했다.

![string, list-type]({{site.url}}/images/binary_xml_string_list_type.png)

이렇게 Serialize한 내용을 `BinaryXml`이라고 불렀다.

아까 `NodeIndex`와 `AttributeIndex`를 언급하면서 `XmlTypeDefine` 내에 기술된 순서(index) 값을 그대로 사용한다고 하였다. 그렇다면 `XmlTypeDefine`이 변경될 경우 당연히 BinaryXml을 잘못 읽을 수 있게 된다는 뜻이다.

이 문제를 해결하기 위해서 BinaryXml 앞 부분에다가 TypeDefine을 넣어주었다. TypeDefine 역시 xml으로 기록이 가능하기 때문에 BinaryXml로 변환이 가능하기 때문이다.

![string, list-type]({{site.url}}/images/binary_xml_whole_file.png)

물론 TypeDefine을 BinaryXml으로 기록하기 위해서는 `TypeDefine에 대한 TypeDefine`이 필요하다. 그래야 `NodeIndex`와 `AttributeIndex`를 얻을 수 있으니까. 그 내용을 서버에서는 `DefineDefine.xml` 이라는 것으로 기술해놨는데 사실 이 부분은 그냥 코드에 박아넣어도 문제가 없었을 것이다.

BinaryXml을 도입함으로써 처음 성능 저하의 원인으로 꼽았던 문제가 모두 해결되었다.

* XML Parsing 비용이 BinaryXml으로 인해 기존처럼 text processing을 안해도 되니 크게 감소하였으며,
* XML Model 객체에 parsing한 결과를 담을 때 이미 개수를 알고 있으니 STL을 사용할 필요도 없어졌다.
* 그리고 필요한 데이터가 BinaryXml로 표현되어 하나의 파일에 모였으니 파일 접근에 의한 IO 시간도 감소하였다.

BinaryXml 데이터 집합을 **DataChunk**라고 표현했다.  
DataChunk를 만드는 과정에서 약간의 번거로움이 있지만 (XmlTypeDefine을 만들어내고, DataChunk를 생성해야 한다) 그래도 서버 시작 시간은 많이 단축되었다. 그리고 위 과정은 CI에 포함하면 되니까 각 개발자들에게 그리 큰 부담이 되는 것은 아니다.

그럼 끝일까?

### update by modification ###

일단 데이터시트 수정 자체는 개발 과정에서 매우 빈번하게 일어나는 일이다. 따라서 DataChunk 내의 BinaryXml만 읽으면 좋겠지만 그럴 수가 없다. DataChunk 내 기록된 BinaryXml보다 xml 파일이 더 최신이라면 그 파일을 읽도록 해주어야 한다. 즉 BinaryXml에 last-modified 값이 기록된 것이고, 이 값을 통해 xml파일과 수정 시각을 비교하여 어떤 파일을 읽을지 결정하도록 한 것이다.

물론 이 구조로는 DataChunk 생성 이후 xml 파일이 삭제되어도 BinaryXml 파일을 읽는 문제가 있다. 즉 없어지는 파일을 감지하지 못하는 문제가 있는 것인데 이 문제는 그리 자주, 혹은 큰 문제를 일으키지 않기 때문에 무시했다.

### wcsicmp ###

더 큰 문제는 DataChunk를 도입했음에도 불구하고 서버 시작 시간이 120~140초 내외였던 것이다(기껏해야 2배 빨라졌다). 목표는 1분 이내였기 때문에 다시 profiling을 돌렸다.

profiling 수행 후 재미있는 결과가 나왔는데, 이는 제일 처음 분석했던 문제 2)와 관련된 *_wcsicmp 함수 사용 부담*이다. 즉, attribute를 검색하기 위해 `string_map`을 사용하였고, 여기서 key compare를 하기 위해 매번 `wcsicmp` 함수가 사용되는데 이 부담이 매우 컸던 것이다. (이 부분이 Release에서는 생각보다 잘 최적화가 된 것 같다. STL의 신비)

`string_map`을 안 쓰기 위해 `index-cache`를 TLS에 넣어두기로 했다. 개념은 다음과 같다.

1. literal string의 주소는 다 동일하니까, literal 주소로 index-cache를 만든다.
2. 이 때 다른 xml의 동일한 literal string의 주소도 같을테니까 TypeDefine의 주소도 섞어서 key로 쓴다.
3. 없으면 TypeDefine에서 AttributeIndex를 찾아서 접근하고, 이 index를 잘 cache해둔다.
4. stack 변수로 attribute 이름이 조합되어 넘어올 수 있으니 잘 integrity를 검사해준다.

![attribute index cache]({{site.url}}/images/binary_xml_attribute_index_cache.png)

BinaryXml의 각 node에 attribute 개수만큼 배열을 미리 만들어둔다. 그러면 `TypeDefine`에서 찾은 `AttributeIndex`로 바로 접근이 가능하기 때문이다. (물론 TypeDefine에서 Attribute를 찾을 때에는 string_map을 쓴다)

대신 한 번 찾은 `AttributeIndex`는 계속 쓸 수 있도록 잘 cache해둔다. 여기서 사용한 개념이 동일한 literal string의 주소는 같다인데, 문제는 Skill의 "id"도, Npc의 "id"도 같은 주소이기 때문에 그 literal 주소만 key로 쓰면 안되고, 그게 어떤 TypeDefine에 소속되어있는지 까지 key로 잡기 위해 **각각 주소의 하위 32bit를 엮어서** key로 쓴 것이다.

그리고 가끔 stack으로 attribute 이름이 넘어오는 경우가 있다. 예를 들면 value1, value2, ...., value5 같은게 있는데 이 때는 주소가 모두 동일하니 위 방법으로도 제대로 걸러낼 수가 없다. 따라서 무결성 검사 항목을 value의 하위 32bit에 넣었다. 방법은 간단히 맨 앞 2글자와 맨 뒤 2글자를 ^ 연산하는 것. 일단 저정도만 해도 문제 상황은 없어서 저정도 수준으로 구현을 했다.

### 정리 ###

위 내용까지 적용하고 나니, 놀랍게도 Debug 빌드 서버 시작 시간이 40초로 줄었다. 기존 240초에 비하면 약 6배 정도 빨라진 것이다.

DataChunk를 만드는 과정의 번거로움은 있지만 충분히 도입할만한 가치가 있는 물건이 나온 것이다. (라고 본인은 생각하는데 아직 안 쓰는 사람도 꽤 있는 것을 보니 본인만 그렇게 느끼는 듯 싶기도 하고)

최근에 [C#으로 게임 서버 만들기]({% post_url 2013-06-07-csharp-game-server %})로 회사 내 발표를 진행하면서 "데이터는 왜 또 Xml을 고려하신건가요?" 라는 질문을 받았다. Xml 데이터로 인한 로딩 시간을 질문하신 것 같은데,

위 작업을 진행하면서 내가 내린 결론은,

1. Xml의 Parsing 속도가 느린 것은 사실이지만 충분히 개선하여 잘 사용할 수 있다.
2. 문제의 도메인에 집중하여 완벽한 해결책이 아닌 가용한 해결책을 내자

이다.
배운다는 입장에서는 2번이 더 중요한 것이지만, 어쨌든 회사에서 일하는 몸이니 1번 사항에 대해서 잠깐 이야기를 해보자.

게임을 만든다고 했을 때 데이터를 기술할 수 있는 방법은 여러가지가 있을 것이다.
그냥 txt로 쓰거나, 아니면 프로그래밍 언어로 쓰거나. xml이나 json, yaml 등의 잘 알려진 형태로 기술하거나 아니면 직접 DSL을 작성하여 기술하거나.

개인적인 성향으로는 DSL도 나쁘지는 않지만 작업할 수 있는 IDE나 Validator 수준을 만들어주지 않는다면 또 다른 재앙을 불러일으킨다고 보는 편이기 때문에 그닥 현업에서는 사용하고 싶지 않다. txt나 csv는 말하고 싶지도 않고.

xml/json을 비교해 본 적이 있는데 json을 지지하는 사람은 꽤 있지만 개인적으로 데이터를 사람이 입력하는 입장에서 json은 그닥 좋은 느낌을 못 받았다. xml로 복잡하게 기술된 내용을 json으로 기술했을 때 그 복잡함이 어디로 가는게 아니었기 때문-_-

xml이 그럼 낫냐? 라고 하면 역시 그거에도 동조하고 싶지는 않다. 이쯤에서 무슨 소리를 하고 싶냐! 라는 소리가 들리는 것 같은데, 정말 하고 싶은 이야기는 format 보다도 **어떻게 데이터를 설계할 것이냐가 더 중요하다는 것이다.**

xml로 작성된 데이터로부터 더러움을 느꼈다면 그게 xml 본연의 문제일 확률은 낮다. 단지 xml을 더럽게 써서 그랬을 뿐이지. xml을 사용함으로 인해 발생하는 parsing 시간 소요 등의 이슈도 여러 가지 방법으로 해결할 수 있다. 데이터를 설계할 때 무엇을 고려해야할 지에 대한 이야기를 하자면 구구절절 끝도 없고 본 글의 제목과도 맞지 않을 것 같으니 이 글은 여기서 접고, 데이터 설계 이야기는 다음 글에서 하도록 하겠다.
