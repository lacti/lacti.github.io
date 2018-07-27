---
layout: post
title: 자바로 만드는 비행기 게임 2
tags: java game
---

노란색 타원 대신 비행기 이미지를 제대로 띄워보자.  
자바에서 이미지를 읽는 것은 간단하다.

```java
java.awt.Image ship = java.awt.Toolkit.getDefaultToolkit().getImage("player.gif");
```

AWT에서 제공해주는 `Toolkit`의 helper function인 `getImage` 함수를 통해 이미지 객체를 얻을 수 있다. (물론 player.gif 는 프로젝트 안에 들어있어야 한다.)

그럼 이제 그리는 방법을 알아보자.  
그림을 그리는 것도 당연하지만, `Graphics` 객체가 존재하는 `paintComponent` 함수에서 이루어진다.

```java
protected void paintComponent(java.awt.Graphics g) {
    g.drawImage(ship, shipPos.x, shipPos.y, this);
}
```

마지막에 들어가는 this는 `ImageObserver` 라고 한다.
Toolkit은 큰 Image를 읽어달라고 요청받으면 MediaTracker라는 요상한 것을 써서 비동기적으로 읽고 그 결과를 `ImageObserver`에게 알려준다.
즉,

```java
java.awt.Image ship = java.awt.Toolkit.getDefaultToolkit().getImage("veryBigShip.bmp");
int shipWidth = ship.getWidth()
```

와 같이 했을 때 ship 객체는 아직 데이터가 읽어지지 않은 상태에서 `getWidth` 함수가 호출되어 저기서 반환되는 값이 이상한 값이 될 수가 있다. (이 때문에 ImageIO 와 BufferedImage 객체를 쓰지만 그건 나중에 이야기하자)  
따라서 `ImageObserver`라는 callback을 써서 데이터가 없을 때는 일단 가짜 정보가 반환되고, 실제로 로딩이 완료되면 `ImageObserver` 내의 `imageUpdate` 함수를 호출해주어서 이미지 로딩 완료를 알려준다는 것이다.

여기서 this는 `JPanel` 객체이다. AWT 라이브러리들은 기본 `imageUpdate` 함수가 구현되어있으므로 처리하기 귀찮은 `ImageObserver`에는 `this`를 넣어주면 된다.  
(자세하게 설명하는건 이 글타래의 취지에 맞지 않으니 더 이상의 자세한 설명은 생략한다.)

아무튼 위의 방법으로 비행기를 그리면 중앙이 맞지 않기 때문에 그림의 width, height 값으로 보정을 해주어야한다.

```java
protected void paintComponent(java.awt.Graphics g) {
    g.drawImage(ship, shipPos.x - ship.getWidth(this) / 2, shipPos.y - ship.getHeight(this) / 2, this);
}
```

매번 width와 height를 가져와달라고 호출하니 효율이 영 좋지 못할 것 같지만, 자바로 짜는 상황에서 효율을 너무 고려하면 슬퍼지니까 그러려니 하고 넘어가자.

player.gif 파일의 배경이 흰색이므로, 게임 전체 배경색도 흰색으로 바꾸자.
그러면 전체적으로 아래와 같은 코드가 된다.

```java
import java.awt.*;
import java.awt.event.*;
import javax.swing.*;
public class Tatieul extends JPanel implements KeyListener {
    private Point shipPos = new Point(320, 400);
    private Image ship;
    public Tatieul() {
        setPreferredSize(new Dimension(640, 480));
        setFocusable(true);
        addKeyListener(this);
        ship = Toolkit.getDefaultToolkit().getImage("player.gif");
    }
    public void keyPressed(KeyEvent e) {
        switch (e.getKeyCode()) {
        case KeyEvent.VK_UP:    shipPos.y -= 10; break;
        case KeyEvent.VK_DOWN:  shipPos.y += 10; break;
        case KeyEvent.VK_LEFT:  shipPos.x -= 10; break;
        case KeyEvent.VK_RIGHT: shipPos.x += 10; break;
        }
        repaint();
    }
    public void keyReleased(KeyEvent e) {}
    public void keyTyped(KeyEvent e) {}
    public void paintComponent(Graphics g) {
        g.setColor(Color.white);
        g.fillRect(0, 0, 640, 480);
        g.drawImage(ship, shipPos.x - ship.getWidth(this) / 2, shipPos.y - ship.getHeight(this) / 2, this);
    }
    public static void main(String[] args) {
        JFrame frame = new JFrame("Tatieul - New Generation Shooting Game");
        frame.setContentPane(new Tatieul());
        frame.pack();
        frame.setLocationRelativeTo(null);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setVisible(true);
    }
}
```

자 이제 총알을 날려보자.  
Space키를 누르면 총알을 만든다. 그 총알은 당연히 위로(-y) 올라갈 것이고, 화면에서 사라지면(y < 0) 소멸될 것이다.

먼저 Space키를 누르면 총알을 만들자. 총알의 종류가 하나 밖에 없으니, 위치 정보만 저장해두자.

```java
private List<Point> bullets = new ArrayList<Point>();
```

이제 Space \를 누르면 총알을 만들어보자.

```java
switch (e.getKeyCode()) {
case KeyEvent.VK_SPACE: bullets.add(new Point(shipPos.x, shipPos.y); break;
```

비행기가 어차피 `shipPos`를 중앙 삼아서 그려지므로, 위와 같이 총알을 만들면 비행기 한 가운데서 총알이 나가는 것 처럼 보일 것이다.

이제 시간에 따라 총알이 앞으로 나가야할 것이다.

시간에 따라 이벤트가 발생하려면 Timer 를 쓰면 된다.  
하지만 Timer 라고 하면 `java.util.Timer`와 `javax.swing.Timer` 2개가 있다.
UI Thread에 의해 동기적으로 처리하는 것이 로직 구성하는데 편하니까 `javax.swing.Timer`를 쓸거다.

```java
public Tatieul() { // Constructor
    new javax.swing.Timer(100, this);
```

이제 Timer는 100ms마다 한 번씩 this의 `actionPerformed` 함수를 불러준다. 즉, `Tatieul` class는 `ActionListener` interface를 구현해야 한다.

```java
public class Tatieul extends JPanel implements KeyListener, ActionListener {
    public void actionPerformed(ActionEvent e) {
        // update bullets
    }
```

총알은 `bullets`에 저장되어있다. 이 자료구조를 한 번 돌면서 y 값을 갱신해주면 되겠다.
하지만, y가 음수인 것에 대해서는 목록에서 빼야하니까, 귀찮다. 이 두 가지를 한 번에 하기 위해 Iterator를 쓰자. (enhanced for 문에서는 중간에 remove 가 불가능하니까.)

```java
Iterator<Point> iterator = bullets.iterator();
while (iterator.hasNext()) {
    Point bullet = iterator.next();
    bullet.y -= 20;
    if (bullet.y < 0)
        iterator.remove();
}
repaint();
```

총알의 위치를 갱신했으면 꼭 `repaint` 함수를 불러줘야 한다. 그래야 갱신된 위치로 총알을 다시 그린다.

이제 `paintComponent` 함수에서 `bullets` 목록을 돌면서, 총알을 그려보자.

```java
protected void paintComponent(Graphics g) {
    g.setColor(Color.black);
    for (Point bullet: bullets)
        g.drawLine(bullet.x, bullet.y, bullet.x, bullet.y - 4);
```

여기까지하면 전체적인 코드는 다음과 같다.

```java
import java.util.*;
import java.awt.*;
import java.awt.event.*;
import javax.swing.*;
public class Tatieul extends JPanel implements KeyListener, ActionListener {
    private Point shipPos = new Point(320, 400);
    private Image ship;
    private ArrayList<Point> bullets = new ArrayList<Point>();
    public Tatieul() {
        setPreferredSize(new Dimension(640, 480));
        setFocusable(true);
        addKeyListener(this);
        ship = Toolkit.getDefaultToolkit().getImage("player.gif");
        new javax.swing.Timer(100, this).start();
    }
    public void keyPressed(KeyEvent e) {
        switch (e.getKeyCode()) {
        case KeyEvent.VK_UP:    shipPos.y -= 10; break;
        case KeyEvent.VK_DOWN:  shipPos.y += 10; break;
        case KeyEvent.VK_LEFT:  shipPos.x -= 10; break;
        case KeyEvent.VK_RIGHT: shipPos.x += 10; break;
        case KeyEvent.VK_SPACE: bullets.add(new Point(shipPos.x, shipPos.y)); break;
        }
        repaint();
    }
    public void actionPerformed(ActionEvent e) {
        Iterator<Point> iterator = bullets.iterator();
        while (iterator.hasNext()) {
            Point bullet = iterator.next();
            bullet.y -= 20;
            if (bullet.y < 0)
                iterator.remove();
        }
        repaint();
    }
    public void keyReleased(KeyEvent e) {}
    public void keyTyped(KeyEvent e) {}
    public void paintComponent(Graphics g) {
        g.setColor(Color.white);
        g.fillRect(0, 0, 640, 480);
        g.drawImage(ship, shipPos.x - ship.getWidth(this) / 2, shipPos.y - ship.getHeight(this) / 2, this);
        g.setColor(Color.black);
        for (Point bullet: bullets)
            g.drawLine(bullet.x, bullet.y, bullet.x, bullet.y - 4);
    }
    public static void main(String[] args) {
        JFrame frame = new JFrame("Tatieul - New Generation Shooting Game");
        frame.setContentPane(new Tatieul());
        frame.pack();
        frame.setLocationRelativeTo(null);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setVisible(true);
    }
}
```


여기까지 따라 해봤다면, 키 입력에 상당한 불만이 생길 것이다.
Space키를 누르면서 방향 키를 누르면, 분명 총알도 나가면서 이동도 되면 좋겠지만 전혀 그렇지 않고 총알이 안 나간채로 움직이기만 하는 것을 볼 수 있다.

이러한 것을 단박에 개선하고 싶지만, 일단 다음은 적기 출현과 충돌 검사를 먼저 구현해보자.