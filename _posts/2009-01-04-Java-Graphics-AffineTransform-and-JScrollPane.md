---
layout: post
title: Java Graphics와 AffineTransform, 그리고 JScrollPane
tags: java -pub
---

예전에 디비랩 알바를 할 때, 어떤 이미지에 대해 확대, 축소, 이동을 해야할 일이 생겼다.
`MouseEvent` 처리 시 좌표 계산 등, 몇 가지 계산을 해서 Image를 확대, 축소, 이동해서 볼 수 있도록 하였다.

`Applepie(YPE2)`를 만들 때 역시 이미지에 대해 확대, 축소, 이동을 할 일이 있었는데 이 때는 이미지가 하나가 아니라, 여러 이미지를 그려야하는 상황이었다.  
각각에 대해 동일한 비율로 확대, 축소, 이동을 도무지 못 해서 결국 이미지를 `BufferedImage`에 다 그려놓고, 그걸 화면에 확대해서 그리는 방식으로 했었다.
덕분에 메모리가 더 많이 사용되었고, 더 느렸다.

EventHandling은 역시 별도로 계산해주어야 했다.

### AffineTransform ###

Game Programming 시간에 `AffineTransform`을 배웠다.
전에 Gepard를 만들 때 동아리 선배 한 분이 이를 써서 지형을 그려주셨는데, 그 때만 해도 이게 무슨 역할을 하는지 몰랐었다.
이번에, 또, 확대, 축소, 이동을 하는 부분을 짜야하는데 이번에는 여러 이미지 뿐만 아니라 그 위에 여러 shape도 그려야 했고, 현재 편집모드에 따라 다른 것들이 그려야 했다.

이걸 어찌해야하나 고민을 했는데 `AffineTransform`을 쓰니까 한번에 끝난다 [...]

```java
AffineTransform oldTransform = g2d.getTransform();
AffineTransform newTransform = new AffineTransform(oldTransform);
newTransform.scale(factor, factor);
newTransform.translate(-viewport.x, -viewport.y);
```

scale와 translate를 해서 Graphics에 지정해주고 그냥 전체를 화면에 다 그리게 하면, 지정된 viewport 영역에 대해 scale되어 나오게 된다.  
물론 EventHandling은 자체 계산해야 한다 [...]

### clipping ###

clipping을 하기 위해 viewport 영역으로 clipping을 해주면 되겠구나라는 생각을 했다.
그래서 `JScrollPane`으로 감싸고, 그 안에 `Graphics`를 수행하는 `Panel` 객체를 넣어서 Clipping을 했는데, `JScrollPane`의 ScrollBar가 안 그려지는 것이었다.

찾아보니까,  
`JScrollPane`는 자신이 현재 보여주고 있는 viewport만을 그리기 위해 이미 자기가 알아서 clipping을 수행한다는 것.  
그래서 `JScrollPane`의 viewport보다 작은 영역을 clipping하는 것은 상관 없지만, 더 큰 영역을 clipping하면 오히려 `JScrollPane`이 망가지게 된다는 것이다. JScrollPane 쓴 덕분에 Clipping까지 그냥 끝

### JScrollPane ###

`JScrollPane` 안에 들어있는 JPanel 등의 객체들은 아무리 내가 원하는 크기를 `PreferredSize`로 지정을 해도 viewport의 크기게 맞게 맞춰져버리는 성질이 있다. (이게 바로 clipping 효과 때문이 아닐까 하는데, 그리는건 둘째치고 Event 영역 한정지어줘야 하는게 귀찮다.)

그래서 쓰는 방법이,

```java
final JPanel container = new JPanel(new GridBagLayout());
final JScrollPane scrollPane = new JScrollPane(container);
this.setPreferredSize(new Dimension(600, 480));
container.add(this);
```

바로 이것이다. (물론 다른 Container에 이 덩어리를 추가할 때는 scrollPane 객체로 추가해줘야 한다. 그래야 scroll 생긴다.)
`Graphics`를 수행하는 Component가 this일 때, 자신의 크기를 `setPrefferedSize`로 정하고, 자기를 바로 `JScrollPane`에 추가하는 것이 아니라 중간에 container 객체를 하나 두는데, 이 container의 `LayoutManager`로 `GridBagLayout`을 사용하는 것이다.
그러면 this는 container 객체의 가운데에 위치하게 되고, container가 this의 크기보다 작아지면 `JScrollPane`에 의해 ScrollBar가 생기게 된다.

물론 this의 `PreferredSize`를 변경해준 뒤에는 revalidate를 호출해서 `JScrollPane`이 크기가 변경되었음을 감지할 수 있도록 해주어야 한다.

### 정리 ###

Viewport와 Magnification을 이용한 Graphics, 그리고 JScrollPane을 통한 Scrolling을 수행하려면 `AffineTransform`과 `GridBagLayout` container를 이용하는 것이 좋다.