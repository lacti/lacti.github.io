---
layout: post
title: JPanel 상속
tags: java -pub
---

Java에서 UI 코드를 작성할 때, 가장 많이 하는 코딩 방식이 UI Pane class를 만들고 이 class가 JPanel을 상속받는 것이다.  
하지만 생각해보면 그 class는 전혀 `JPanel`을 상속받을 필요가 없고 그냥 `JPanel` 객체를 멤버 변수로 하나 만들어서 contain pane으로 사용해도 된다.  
그러면 그 class는 정확히 `controller` 역할을 수행할 것이고(event handling을 포함하여) `controller`가 view(`JPanel`, `JLabel`... 등) 객체들의 reference 변수를 알고 변경시키는 깔끔한 MVC 구조가 성립된다.

하지만 `JPanel`을 상속받은 객체 내에서 controller일을 수행하면,  
`JPanel`을 상속받은 시점에서 그 class가 view class화 되기 때문에 `V`랑 `C`가 합쳐지는 듯한 해석이 가능해지는데 어차피 코드 입장에서는 크게 달라지는게 없으므로 이런 해석은 사실상 의미가 없기는 하지만 생각해보면 굳이 상속을 받아야할 필요는 없으므로 상당히 애매한 위치에 놓인다.

요약하면

1. 상속을 받아서 UI를 구성해도 되고
2. 상속을 받지 않고 변수로 UI를 구성해도 된다.

다만, 자주 사용되는 UI class의 경우에는 1)의 방법은 상속을 통한 객체 기능 확장, 2)의 방법은 합성을 통한 객체 구성이니까 내부 method를 직접 공개(public)할 것이냐 아니면 위임(delegation)할 것이냐의 약간의 차이가 발생하겠다.  
아무튼 생각해보면 별 것도 아닌데 원래 별 것 아닌 것에 대해서 의미를 읽어서 명확히 하는 설계 짓을 하는 것이기 때문에-_- 한 번쯤은 고민해볼 가치가 있다고 생각한다.

하지만 대부분의 UI 설계는 `JPanel`을 상속받으면서부터 시작한다. 이러한 습관이 들어버린건 다 NetBeans 때문이다-_-

View와 Controller가 섞이면 coupling이 심해져 코드가 좀 더러워진다. 때문에 중간에 interface를 두고 나누는 방법도 생각해볼 수 있겠다.  
(이걸 심하게 해주시는 분이 로버드 C. 마틴 이란 분인데 [UML 실전에서는 이것만 쓴다](http://www.yes24.com/24/goods/4492519) 책이 재밌다)

최근에 운 좋게도 그래디 부치 책을 구했으니 좀 더 공부를 해봐야겠다.

* http://en.wikipedia.org/wiki/Robert_Cecil_Martin
* http://en.wikipedia.org/wiki/Grady_Booch

유명하신 분들이다.