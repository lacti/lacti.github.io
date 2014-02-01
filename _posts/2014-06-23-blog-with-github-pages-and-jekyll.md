---
layout: post
title: github pages와 jekyll을 사용한 blog 만들기
tags: web -pub
---

본 글에서는 [jekyll]과 [travis-ci]를 사용하여 [github pages]에 publish하고, 이를 custom domain에 연결하여 blog를 구축하는 방법에 대해 서술한다.

[github pages]는 [github]에서 제공하는 cdn으로 static page를 서비스해주는 공간이다. github pages에 자세한 설명이 나와있지만 간단히 요약하면,

* *{본인 id 혹은 그룹 id}.github.io* 라는 repository를 만들거나,
* 프로젝트 repository에 *gh-pages* 라는 브랜치를 만든 후,
* 뭔가의 파일을 올려놓으면 **{...}.github.io** 라는 주소로 접근이 가능하다는 것이다.

따라서 저 공간에 html 파일을 올려놓는다면 static page를 제공할 수 있다. 따라서 블로그에 작성할 글들을 하나하나 html로 작성해서 위 repo에 push하면 블로그를 만들 수 있다는 것이다.

### static site generator

글을 쓸 때마다 하나씩 html을 작성하는 것은 매우 번거로운 일이므로, site generator를 사용해보자. 본 글에서는 github pages에서 기본으로 제공해주는 [jekyll]을 사용할 것이다.

* [jekyll] 페이지의 안내에 따라 설치한 후, `jekyll new my-blog` 명령을 사용하여 기본 골격을 만들어보자.
* 이제 `_posts` 디렉토리에 적절한 형태(markdown, textile, text, ...)로 글을 작성한 후
* `jekyll serve` 명령으로 서버를 띄우고 작성한 글이 제대로 나오는지 보면 된다.

위 과정까지 진행했다면 `_sites`라는 디렉토리에 생성된 결과물이 모여있는 것을 볼 수 있다. 저 파일들을 아까의 repo에 올려서 블로그를 운영할 수도 있겠지만 **github pages는 기본으로 jekyll을 지원하므로** 번거롭게 매번 `_sites`를 만들어 파일을 올릴 필요없이 `jekyll new`로 만들어진 파일들을 올려놓으면 된다.

* 즉, `jekyll new`로 만들어진 파일들을 repo에 push해놓고,
* `_posts`에 글을 쓴 후 push하면 블로그를 운영할 수 있다는 것이다.

개인적으로는 [gfm](https://help.github.com/articles/github-flavored-markdown)을 좋아하기 때문에 markdown으로 글을 작성한다.

### custom domain

기왕 만든 블로그니 도메인도 멋지게 연결해주고 싶을 수 있다. 이에 대한 설명은 [Setting up a custom domain with github pages](https://help.github.com/articles/setting-up-a-custom-domain-with-github-pages)에 잘 나와있다. 이에 대해 요약하면,

위 repo에 CNAME 파일을 만들어 도메인을 기록한다. 예를 들면 `lacti.me`와 같이 적은 파일을 push해준다.

`lacti.me`처럼 subdomain이 아니라 apex domain일 경우에는 *A 레코드 설정*을 해준다.

* [dotname]일 경우에는 `도메인 레코드 관리`에 들어가 `A 레코드 설정`에 ip를 추가해주면 된다.
* [dnsever]일 경우에는 `호스트 IP(A) 관리`에 들어가 ip를 추가해주면 된다.
* 이 때 www는 github pages에서 redirect를 해주므로 subdomain 입력 없이 ip만 입력하고 추가를 해주면 된다.
* 추가할 ip 주소는 현재 `192.30.252.153`, `192.30.252.154` 인데 이는 추후 변경될 수 있으므로 [Tips for configuring an a record with your dns provider](https://help.github.com/articles/tips-for-configuring-an-a-record-with-your-dns-provider) 페이지를 참고하는 것이 좋다.

`blog.lacti.me`처럼 subdomain일 경우에는 *CNAME 레코드 설정*을 해준다.

* [dotname]일 경우에는 `도메인 레코드 관리`에 들어가 `CNAME 레코드 설정`에 연결 주소를 추가해주면 된다.
* [dnsever]일 경우에는 `도메인 별명(CNAME) 관리`에 들어가 목적지 도메인을 추가해주면 된다.
* 추가할 주소는 `username.github.io`이다. 작업 후 dig 명령을 사용하여 제대로 연결되었는지 확인해볼 수 있다. 추후 변경될 수 있으므로 [Tips for configuring a cname record with your dns provider](https://help.github.com/articles/tips-for-configuring-a-cname-record-with-your-dns-provider) 페이지를 참고하는 것이 좋다.

그리고 dns가 반영될 때까지 시간이 좀 흐르면 연결한 도메인으로 해당 github pages를 접속해볼 수 있다.

### custom jekyll

github #s에 내장된 jekyll은 보안적인 이슈로 인해 plugin을 사용할 수가 없다. [참고](https://github.com/jekyll/jekyll/issues/325)

jekyll의 기본 기능은 좀 부족해서,

* liquid 태그를 추가한다던가,
* related_posts를 개선한다던가,
* pandoc converter 등을 사용한다던가,

하는 이슈가 발생하게 된다. 이 부분을 개선하려면 plugin을 사용해야 하므로 github pages의 내장 jekyll 대신 [travis-ci]를 통한 `_sites`를 deploy하는 방법을 사용할 것이다.

방법은 다음과 같다.

* *{...}.github.io* repo에서 글을 올릴 브랜치를 만든다. 이 글에서는 이를 `source` 브랜치라고 칭하겠다. 따라서 해당 repo의 `master` 브랜치에는 jekyll이 생성한 결과물이 push될 것이다.
* [travis-ci]를 사용하여 repo의 `source` 브랜치가 변경되었을 때 이를 `jekyll build`하여 그 결과물을 `master` 브랜치에 push할 것이다.

`source`, `master` 브랜치를 만드는 것은 어렵지 않다. 일단 첫 번째 난관은 [travis-ci]에 jekyll을 연결하는 것이다. 다행히도 [https://github.com/mfenner/jekyll-travis](https://github.com/mfenner/jekyll-travis)에 jekyll-travis용 script가 있으니 이를 참고해서 설정을 하면 되겠다.

* `.travis.yml` 파일에 push를 위한 secure token을 입력해야 한다. secure token을 만들어야 하니 다음을 참고. [Sharing travis ci generated files](http://sleepycoders.blogspot.kr/2013/03/sharing-travis-ci-generated-files.html)
* secure token의 길이 제한은 128bytes이므로 암호화할 필요가 없는 변수들은 바깥으로 빼는 것이 좋다. [lacti: .travis.yml](https://github.com/lacti/lacti.github.io/blob/source/.travis.yml)
* 추가 package가 필요할 경우 `Gemfile`에다가 package 파일을 기록해주면 된다.

필요한 설정을 다 했으니 [travis-ci]에 가서 위 repo를 연결해주면 되겠다. `master` 브랜치에 대한 작업은 할 필요가 없으니 *Build only if .travis.yml is present*을 켜주면 된다.

이제 `source` 브랜치의 `_posts`에 글을 commit하면 [travis-ci]가 이를 감지하여 [jekyll]을 실행하고, 그 결과물을 `master` 브랜치로 push해줄 것이다.

### gem cache

잘 돌아가는 것 같지만 한 가지 문제가 있다. github pages의 내장 jekyll을 쓸 때보다 글 반영 속도가 현격히 느리다는 것이다. 그 이유는 gem이 느리기 때문이다. travis-ci에서 한 cycle에 걸리는 시간을 보면 평균 2분 30초 가량이다. 이 때 약 1분 30초 이상을 `gem install` 구분에서 소모하고 있는 것을 볼 수 있다. 이를 개선하기 위해 [rebund]를 사용한 gem cache를 만들어보자.

* [heroku]에 [keyfile]을 올린다.
* [rebund]를 `source` 브랜치에 submodule로 걸고 travis에서 `bundle install` 전후에 `rebund`를 사용하도록 한다. [참고](https://github.com/lacti/lacti.github.io/blob/source/.travis.yml)
* gem의 변경 사항이 없다면 bundle install 시 local만 참조하도록 `bundle install --local`을 수행하게 한다.

[keyfile]과 [rebund]의 설정 방식은 위 페이지의 README에 잘 나와있다. 약간 보충하면,

* keyfile 설치 시 `.env` 파일을 열어서 `database_url`을 변경해주어야 한다. 이 값은 `heroku config --app {appname}` 명령을 통해 확인할 수 있다. postgre 주소를 잘 입력해주면 된다.
* rebund 연결 시 `REBUND_ENDPOINT` 값을 설정할 때 주소 마지막에 `/`이 붙으면 안 된다. 그걸 붙이면 잘못된 url이 만들어져서 curl 명령이 계속 실패한다.
* `bundle install --local`을 안하면 gem fetch가 지속적으로 이뤄지게 되고, 이 과정 역시 30~60초 정도 소모한다. 따라서 추가적인 gem이 필요없다면 한 번 cache한 이후에는 `--local` 옵션을 주는 것이 좋다.

이를 적용하면 2분 30초 ~ 3분 걸리는 작업이 30초 ~ 50초가량으로 줄어들게 된다. 이제 글을 push한 후 1분 정도만 기다리면 해당 글이 블로그에 잘 올라가는 것을 확인할 수 있다.

### 정리

* [github pages]를 사용하여 작성한 글을 배포할 수 있다.
* [jekyll]을 사용하면 보다 쉽게 사이트를 만들 수 있다.
* jekyll 플러그인을 사용할 경우 [travis-ci]을 사용하자.
* 이 때 gem이 너무 느리다면 [rebund]를 사용하자.

### 참고

* [if1live: GitHub Pages와 travis-ci를 엮은 정적 블로그 자동화](http://libsora.so/posts/static-blog-sample/)

[jekyll]: http://jekyllrb.com/
[github]: http://github.com/
[travis-ci]: http://travis-ci.org/
[github pages]: http://pages.github.com/
[dotname]: http://dotname.co.kr/
[dnsever]: http://kr.dnsever.com/
[rebund]: https://github.com/mezis/rebund
[keyfile]: https://github.com/mezis/keyfile
[heroku]: https://www.heroku.com/
