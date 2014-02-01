---
layout: post
title: ctags, cscope 설정 등 vim을 잘 써보자
tags: tool -pub
---

시스템 프로그래밍 수업 듣는 친구들이 vim을 써서 보다 빠르게 커널 탐색을 하는데 도움이 되었으면 해서 쓰는 글이지만 본인이 직접 정리하기는 귀찮으니 다음의 링크를 참조 바람 [...]

* [so_sal: 커널 분석기 Vi + ctags + cscope](http://sosal.tistory.com/11)

### search script ###

추가로, 여러 파일에서 특정 내용을 찾는 좋은 shell script

```bash
#!/bin/bash
echo "- find --------"
echo $1
echo "---------------"
echo
find . -name "*.[chS]" -exec grep -Hn $1 {} \;
find . -name "Make*" -exec grep -Hn $1 {} \;
find . -name "*.inc" -exec grep -Hn $1 {} \;
echo "---------------"

```

확장자가 c, h, S, inc 이거나 Make* 파일에 대해서 지정된 검색어가 있는지 검사한다.
`./search proc` 라고 치면 proc가 들어있는 파일들을 검색함.

### vim + ctags  대충 요약 ###

커널 소스 디렉토리에서 `ctags -R` 을 해서 tags 파일을 만든 뒤, 대충 .vimrc 파일에 다음을 추가하자. (vim이 열리는 위치마다 tags 파일을 만들면 귀찮으니 절대 경로로 tags 파일 경로를 지정해주는 것도 좋다.)

```bash
set dictionary=./tags,/usr/include/tags

"=============== ctags setting =================
set tags=./tags,/usr/include/tags
if version >= 500
        func! Sts( )
                let st = expand("<cword>")
                exe "sts ".st
        endfunc
        nmap ,st :call Sts( )<cr>

        func! Tj( )
                let st = expand("<cword>")
                exe "tj ".st
        endfunc
        nmap ,tj :call Tj( )<cr>
endif

"=============== man setting =================
func! Man( )
    let sm = expand("<cword>")
    exe "!manc ".sm
endfunc
nmap K :call Man( )<cr><cr>

"============= search setting ================
func! SearchKeyword()
        let sm = expand("<cword>")
        exe "!search ".sm
endfunc
nmap J :call SearchKeyword()<cr>
```

이제 `,st` `,tj` 명령어로 tag jump가 가능한데 목록을 listing해서 창 분할해서 뛸거냐 아니면 현재 창에서 바로 이동할거냐를 고를 수 있다. (개인적으로는 창 분할해서 이동하는 `,st` 을 더 많이 썼다.)

그리고 manpages-dev를 설치했을 때, `K`를 누르면 해당 함수에 대한 manual을 바로 볼 수도 있고, 위에서 만들어놓은 search script와 연동해서 `J`를 누르면 해당 문자열 혹은 심볼을 포함한 파일들을 검색할 수도 있다.

cscope는 실행해보면 대충 알 수 있으니 잘 써보면 된다.