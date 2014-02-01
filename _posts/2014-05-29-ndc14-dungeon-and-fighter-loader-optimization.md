---
layout: post
title: 던전 앤 파이터 클라이언트 로딩 속도 최적화 - 우리 아이가 세배 빨라졌어요!
tags: ndc14 optimization -pub
---

{% oembed http://www.slideshare.net/JaeseungHa/ndc-2014-35508014 %}

* [하재승](https://twitter.com/ipkn)

### 요약 ###

* 최적화 아이디어 공유 (분할 압축, dumpable, resource dependency)
* 하지만 정작 효과가 큰 방법은 버그 수정이었다. (잘못 들어간 logging 삭제)

### 문제 분석 ###

* 유저가 만족하는 편안한 게임을 만들어 보자.
	* 하지만 8년간 라이브를 해서 이미 코드는 누더기 상태. *기술 부채를 넘어선 기술 파산*
	* 데이터 파일 54만개 642mb, packing하면 300mb
	* 이미지 1000만개 이상, 4.1gb
* 매번 HDD를 access하기 때문에 SSD는 필수이고, 메모리 사용량은 2GB를 넘어서 크래시가 발생한다.
* lag 최소화, 메모리 최적화, 크래시 해결, 코드 개선 등이 필요.
	* 그 중 본 발표에서는 lag 최소화를 이야기함.
	* eg) 클라이언트 로딩 속도 개선, 스킬 랙 개선

### 해결 ###

* 데이터 분할 압축
	* packing 시 binary xml 비슷한 형태로 packing해서 300mb인데 이걸 memory map으로 사용하고 있었다.
		* 일부분만 필요하다고 해도 메모리 공간을 다 점유하고 있고,
		* XP SP2 이전에서는 특정 크기 이상 mmap을 못 서서 크래시가 발생한 적도 있다.
		* 무엇보다 HDD read access를 제어할 수 없어 io에 의한 lag이 발생한다.
	* 전체를 압축하면 22mb인데 해제 부담이 있으니 일부분을 빠르게 얻기 위해 **분할 압축을 해보자.**
		* 검증을 위해 최적 block size를 테스트해서 얻어냈다.
		* 한 block이 64kb 정도면 전체 용량이 늘지 않으면서도 압축 해제 시간이 적절했다.
		* 비슷한 종류끼리 압축해서 사용했다.
		* 전체(22mb)를 메모리에 올리고, 필요한 부분만 압축을 풀어서 사용했다.
		* 추후 데이터가 추가될 경우를 위해 incremental packing을 구현했다.
	* memory 사용량이 100mb 정도 감소했고,
	* patch size도 감소했고,
	* data file access time도 감소했는데
	* **로딩 속도 개선은 별로 없었다.**
* [dumpable](https://github.com/ipkn/dumpable)
	* 화면에 출력되는 모든 것은 animation data file로 이루어져 있는데 이는 전체 파일의 50%를 차지한다.
	* 한 화면 로딩할 때마다 대충 2,000개 정도씩 로딩한다.
	* 이에 대한 deserialize 부담이 좀 크니 memcpy 수준으로 로딩이 되면 좋겠다.
		* pointer나 stl container 등에 대해서도 serializable memory를 구성해야 한다.
		* pointer는 상대 주소로 저장하고 동적 할당된 구간에 대해서도 같이 저장한다.
		* serialize/deserialize code도 없으면 좋겠다. code generator 수준이 아니라 그냥 없으면 좋겠다.
	* 그래서 serialize 코드 없고, memcpy 가능한 dumpable 라이브러리를 개발했다.
		* memory 배치를 잘 해서 read는 casting만으로 끝날 수 있도록 했다.
		* 쓰기 부담이 좀 있지만 읽기 부담은 0이고, 복사 비용도 싸다.
		* *(자세한 것은 코드를 읽어보면 된다)*
	* 하지만 그냥 접근하는 파일이 많아서 느린 것이므로 dumpable을 적용했을 때 로딩 시간이 줄어드는 효과는 별로 없었다.
	*  따라서 괜히 코드 복잡도를 높일까봐 적용하지는 않았다.
* 연관 데이터 파일 미리 읽기(preload)
	* 이미지 파일을 미리 읽어서 로딩 속도를 개선하자. *그런데 data dependency가 기술된 파일이 없다.*
	* 그런데 skill-tree에 따라 effect가 달라지고, 직업 별로 독특한 play style이 있어 그에 따른 연관 데이터를 찾기가 어렵다.
		* 심지어 이러한 연관 정보가 데이터로 표현되기 힘들다고 hard coding된 것들이 많다.
	* 기존에는 뭘 읽을지 모르니, 읽고나서 안 버리는 구조로 작성되어 있었다.
		* 덕분에 처음엔 랙이 발생하고 나중엔 메모리 부족으로 클라이언트가 크래시되었다.
	* 정적 분석을 통해 dependency를 찾아보자.
		* define 전처리 후 그 결과를 heuristic하게 parsing해서 코드에 기술된 skill-resource를 분석했다.
		* 제대로 ast 만들어 parsing하지 않으면 제대로된 결과를 얻을 수가 없다.
		* 그냥 대충 나온 것으로 preload 해봤는데 효과가 미비했다.
	* 유저의 loading 로그 기반으로 dependency를 찾아보자.
		* resource를 읽을 때 던전, 이미지, animation 파일 들을 logging하도록 클라이언트에 포함,
		* 테스트 서버에 배포해서 CSV 15gb, 7700만 access 기록을 얻어냈다. *(대충 모든 스킬 정보가 다 포함되었다고 한다. 안 그러면 라이브에 배포할 계획이었다고 한다.)*
			* 스킬에 연관된 이미지는 해당 스킬 발동 후 매번 비슷한 시점에 읽을 것이라는 가정 하에 분산을 계산해서 목록을 추렸다.
			* 스킬 적용 모션은 parts화 되어 있으므로, parts별로 나오는 데이터를 grouping해서 포함할 수 있도록 했다. (face가 나오면 body도 포함하는 식)
			* 던전 resource의 경우 특정 던전에서 반복해서 읽는 것을 추렸다.
		* 데이터 추릴 때 발생한 문제점이 있다.
			* 스킬 사용 직후 맵을 이동하면 데이터 노이즈가 생긴다. 수집 범위 시간을 최대한 좁혀서 회피했다.
			* 저사양 데이터가 섞여서 제대로 구분하기가 어렵다. outlier 강한 분포를 사용해야 할지 어떨지 모르겠다.
			* random effect가 발동되는 경우가 있는데 이건 그냥 무시하거나 노가다로 입력했다.
		* 그리고 주기적으로 수집해서 이전 dependency map과 통합될 수 있도록 하고,
		* 이벤트성 effect의 경우로 데이터가 특정 시점에만 추가될 경우 map을 구성할 때마다 threshold 이하의 참조 resource는 삭제하는 방식으로 제거했다.
	* 적용 후 입장 시간은 증가했지만 랙은 감소했다. 하지만 메모리 사용량 증가로 인해 크래시가 발생했다.
* resource list 미리 구성하기
	* 이미지 1000만개를 image pack 8만개로, 이걸 다시 image pack-pack 2000개로 만들어 배포를 하는데,
	* 처음 구동 시 이걸 다 열어서 list를 구축하는 부분이 있다.
	* 이걸 list로 뽑아서 같이 배포되도록 했다. 그리고 성능 개선됨.
* security logging 버그 수정
	* 보안을 위해 primitive type 변수를 wrapping해서 사용하는데, 여기에 실수로 logging 코드가 들어가 같이 배포가 되었다.
	* 이걸 빼니까 속도가 꽤 향상됬다. (animation 로딩 느린 것도 이 문제였던 것으로 추측된다.)
* 기타 profiling으로 얻은 것
	* std::map은 boost::unordered_map으로 대체한다.
		* vs2010의 std::unordered_map은 boost의 것보다 많이 느리다.
	* tbb의 scalable_alloc으로 약 10% 성능 향상을 얻었다.

### 결과 ###

* 저사양 유저들은 빨라졌다고 좋아하는데 고사양 유저들은 모르겠다거나 더 느려졌다는 반응이다.
* resource list를 직접 배포하는 바람에 custom skin 기능이 막혔다. 근데 유저들이 금방 해결했다.
* 개선 후 메모리 부족 문제로 더 튕기는 현상이 많아졌고,
* 위 개선 사항은 solo play에만 국한된 것이므로 party play이 lag은 여전하다.
* 앞으로,
	* 이제 resource data dependency를 얻었으니 던전 끝나고 불필요한 resource를 해제할 수 있다. 그럼 메모리 사용량을 좀 개선할 수 있을 것이다.
	* 마을 메모리 사용량 높은 이유를 확인해봐야겠다.
	* party play 메모리도 최적화를 해야겠다.

### Q&amp;A ###

* dumpable 사용하다가 casting 실수가 발생하면 어떻게?
	* c++은 원래 그런 언어잖아요?
* 던파의 하드 코딩 수준은 어느 정도?
	* 망했어요.
* 최적화하면서 발생한 버그는 어떻게?
	* 훌륭한 프로그래머는 버그를 만들지 않습니다.

----------

* 본 세션은 기술 세션이라기 보다는 경험 공유 세션이므로, 그 과정을 다 서술하기 위해 노력했다. (덕분에 내용이 길다)
* 전 회사에서 서버 구동 시간 단축을 위해 [노력]({% post_url 2013-06-09-binary-xml-for-fast-loading %})을 해본 적이 있다. 그래서 드는 의문은,
	* 보통 최적화를 할 때에는 [profiling](http://en.wikipedia.org/wiki/Profiling_%28computer_programming%29)을 먼저 한다. vs의 analysis를 쓰든 vtune을 쓰든 돌려보면 느린 함수가 순서대로 잘 나온다. 그리고 보통 그 순서대로 원인을 파악하기 위해 작업을 한다.
	* ~~만약 그랬다면 위 최적화의 적용 순서가 logging 삭제, list 미리 구성, `unordered_map`, `scalable_alloc` 적용, 분할 압축, dumpable 순일 것 같은데 그렇지 않았다~~ *특별히 어느 한 부분이 압도적으로 문제가 되는 부분이 없었다고 한다.*
	* 그렇다는 것은 던파 코드가 analysis를 써도 결과가 제대로 안 나오는 답이 없는 상황 ~~이거나 profiling을 초반에 제대로 못 돌렸다는 것이다~~ 이었다는 것이다.  
	  *발표 시점에 해당 내용을 놓친 것 같다. 발표자님의 댓글 도움으로 수정*
* 따라서 다른 누군가가 위 세션에 감동을 받아 최적화를 진행한다고 하면,
	* 잘못된 logging 코드나 preload dependency map 구성에 집중하는 것이 아니라,
	* profiling을 수행한 결과를 보고 target을 추린 뒤,
	* 위에서 사용한 논리 전개 방식을 참고하여 진행하는 것이 좋을 것 같다.
* 다음의 방법들은 참신하거나 재미있었다.
	* 효율적인 분할 압축의 크기를 대충 계산한 것이 아니라 직접 script를 만들어 테스트를 해봤다.
	* 유저 로그를 분석할 때 시간을 grouping하기 위해 분산을 사용했다.
	* dumpable 라이브러리에서 reflection 없이 각 member를 serialize하기 위해 custom-serializable-type (`dptr`, `dstring`, `dvector`, `dmap`)에 대한 `operator =` 를 사용했다.
		* 각 member의 size와 추가 할당된 데이터를 가져오는 것이 핵심인데,
		* 위 type의 `operator =`를 구현해놓고, `T temp = original;`과 같이 복사하면 각 member의 `operator =`가 불리니까 여기서 size를 얻고 추가 할당 데이터를 local pool에 복사할 수 있다.
		* 하지만 위 map을 구성하는 `dptr_alloc()`이 static 변수라 thread-safe하지 않은 문제가 있다.