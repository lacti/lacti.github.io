---
layout: post
title: 자바로 만드는 비행기 게임 1
tags: java game -pub
---

본 글타래에서는 자바를 사용하여 간단한 비행기 게임을 만드는 과정을 서술해볼까 한다.

원활한 자바 프로그래밍을 위해서, [JDK](http://www.oracle.com/technetwork/java/javase/downloads/index.html)와 [Eclipse](http://eclipse.org/downloads/)가 설치되어있어야 한다.
이에 대한 자세한 설명은 생략하고, 멋들어진 이름으로 프로젝트를 하나 만들어보자.

예전에 제출했던 이름을 따와서 타티을(Tatieul)이라는 이름으로 class를 하나 만들었다.

```java
public class Tatieul {
	public static void main(String[] args) {

	}
}
```

간단한 슈팅 게임을 만들어보자.

* 비행기 같은게 나와서, (Graphics)
* 화살표 키를 통해 움직이고, (Event Handling)
* 적기가 등장하면 그걸 미사일을 쏴서 맞추고, (Collision Detecting)
* 적기가 쏘는 미사일을 피해야 한다. (Enemy AI)
* 여러 사람이 할 수 있다면 더 재밌을 것 같다. (Network)

먼저 화면에 무언가를 그리려면 창을 띄워야 한다.
자바에서 창을 띄우려면 AWT(Abstract Window Toolkit)을 쓰거나, AWT의 확장 버전인 Swing을 쓰면 된다. 본 글에서는 개인적인 취향에 따라 Swing을 쓰도록 하겠다.

창을 띄우기 위해 `JFrame`을 사용하겠다. 사용하기 가장 쉬운 방법은? **상속** 해보는거다.
하지만 `JFrame`을 상속받으면 나중에 Graphics를 할 때 상당한 성능적 문제가 생긴다. (마치 ERASE_BACKGROUND 메시지에 의해 flickering 이 지속적으로 발생하는 것과 같은.)

아무튼 그런고로 무언가를 담을 수 있는 좋은 class인 `JPanel` class를 상속받는다.

```java
import javax.swing.*;
public class Tatieul extends JPanel {
	public Tatieul() {
		setPreferredSize(new Dimension(640, 480));
	}
	public static void main(String[] args) {
		JFrame frame = new JFrame("Tatieul - New Generation Shooting Game");
		frame.setContentPane(new Tatieul());
		frame.pack();
		frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		frame.setVisible(true);
	}
}
```

코드의 양이 확 늘어났지만 별로 하는 일은 없다.  

* `JPanel` class를 상속 받은 `Tatieul` class가 생성될 때 자신의 크기를 640, 480으로 정한다.
* `main` 함수에서는 창을 띄우기 위한 `JFrame` 객체를 하나 만든다. 생성 인자로는 창의 Title을 넣을 수가 있다.
* `setContentPane` 함수를 사용해서 `Tatieul` 객체를 넣는다. 이제 창에 우리가 만든 Tatieul 객체가 보여지게 되는 것이다.
* `pack` 함수를 통해 창 크기를 contentPane의 크기에 맞춘다. contentPane은 방금 Tatieul 객체로 지정했는데, Tatieul 객체는 생성할 때 640, 480으로 크기를 지정했으니까 창의 크기도 `pack` 함수에 의해 640, 480이 된다.
* `setDefaultCloseOperation` 함수는 창이 종료될 때 어떤 동작을 할지 결정하는 함수다. `JFrame.EXIT_ON_CLOSE` 값을 인자로 주면 창을 끌 때 프로그램이 같이 끝난다. 만약 이 코드를 추가하지 않으면, 이 자바 프로그램은 창을 닫아도 메모리에 계속 남아있게 될 것이다!
* 마지막으로 `setVisible` 함수를 통해 완성된 `JFrame` 객체를 화면에 띄워준다.

민둥 창 하나가 떴다. 이제 그림을 그려보자.
그림을 그리기 위해서는 `paintComponent` 함수를 override하면 된다.

```java
import java.awt.*;
import javax.swing.*;
public class Tatieul extends JPanel {
	public Tatieul() {
		setPreferredSize(new Dimension(640, 480));
	}
	public void paintComponent(Graphics g) {
		g.setColor(Color.black);
		g.fillRect(0, 0, 640, 480);
	}
	public static void main(String[] args) {
		JFrame frame = new JFrame("Tatieul - New Generation Shooting Game");
		frame.setContentPane(new Tatieul());
		frame.pack();
		frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		frame.setVisible(true);
	}
}
```

`paintComponent`란 함수를 보면 인자로 `Graphics` 객체를 받는다. `Graphics` 객체는 그림을 그리는데 필요한 여러 함수들을 가지고 있다.
일단 색상을 지정하는 `setColor` 함수와 사각 영역을 칠해주는 `fillRect` 함수를 통해서 창을 검게 만들어봤다.

이제 비행기를 그려보자.
일단, 비행기를 어디에 그려야할지 위치 정보가 있어야겠다. 화면은 2D이니까 x, y 좌표만 있으면 되겠다. 이를 저장하기 적절한 `Point` 객체를 써보자.

```java
import java.awt.*;
import javax.swing.*;
public class Tatieul extends JPanel {
	private Point shipPos = new Point(320, 400);
	public Tatieul() {
		setPreferredSize(new Dimension(640, 480));
	}
	public void paintComponent(Graphics g) {
		g.setColor(Color.black);
		g.fillRect(0, 0, 640, 480);
		g.setColor(Color.yellow);
		g.fillOval(shipPos.x - 8, shipPos.y - 16, 16, 32);
	}
	public static void main(String[] args) {
		JFrame frame = new JFrame("Tatieul - New Generation Shooting Game");
		frame.setContentPane(new Tatieul());
		frame.pack();
		frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		frame.setVisible(true);
	}
}
```

`Point` 객체를 멤버 변수로 하나 갖는데 그 이름이 무려 `shipPos`다. 이름에서 느껴지듯이 플레이어의 Ship의 x, y 좌표 값을 저장한다. 기본값을 320, 480으로 주었다.
그리고 `paint` 함수에서 이 값을 사용해서 Ship을 그린다.
색을 노란색으로 지정하고, `fillOval` 함수를 사용해서 타원을 채운다. `shipPos`를 중심으로 가로길이 16, 세로길이 32짜리 타원을 그리는데 `shipPos`가 Ship의 중앙 지점이 되어야하므로 길이를 반으로 나눈 값을 x, y에서 빼주어서 중심 좌표에 타원을 그리도록 하였다.


이제 화살표키 입력을 통해 Ship 을 움직여보자.  
화살표키 입력을 받으려면 `KeyListener` 인터페이스의 구현체가 필요하다. 그리고 이 구현체를 `addKeyListener` 함수를 통해 넣어주면 키 입력에 대한 통지를 받을 수 있다.

간단하게 `Tatieul` class 에서 `KeyListener` interface를 구현해보자.

```java
import java.awt.*;
import java.awt.event.*;
import javax.swing.*;
public class Tatieul extends JPanel implements KeyListener {
	private Point shipPos = new Point(320, 400);
	public Tatieul() {
		setPreferredSize(new Dimension(640, 480));
		setFocusable(true);
		addKeyListener(this);
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
		g.setColor(Color.black);
		g.fillRect(0, 0, 640, 480);
		g.setColor(Color.yellow);
		g.fillOval(shipPos.x - 8, shipPos.y - 16, 16, 32);
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

`KeyListener` interface를 구현하면 3개의 함수를 반드시 구현해야한다.
`keyPressed`, `keyReleased`, `keyTyped` 함수가 그것인데, 비행기를 움직일 때는 키가 눌렸을 때 바로 처리할 것이기 때문에 나머지 두 개의 함수는 쓸 일이 없고, `keyPressed` 함수에서만 어떤 key가 눌렸는지 분기해서 `shipPos` 값을 변경하도록 한다.

그리고 변경을 한 다음에는 반드시 `repaint` 함수를 호출하여 변경된 비행기를 화면에 다시 그려주어야 한다.

이러한 key 처리 코드가 제대로 동작하려면 key 입력 통지를 받아야 한다.  
생성자에서 보면 `addKeyListener(this)`와 같은 코드가 있다. `JPanel` class를 상속받은 Tatieul 객체에서 키 입력이 발생하면 그것을 `this`에게 알려주겠다는 것이다. 즉, 키가 눌리면 `Tatieul` class의 `keyPressed` 함수가 호출되게 된다는 것이다.

빼먹으면 안 되는 것이 하나 있다. 바로 `addKeyListener` 함수 위에 있는 `setFocusable(true)` 인데,
이것을 true로 주지 않으면 `JPanel` 객체는 focusable하지 않은 상태가 되어서 키 입력을 받지 못하는 상태가 되어버린다!  
따라서 키 입력을 받을 수 있도록 focusing이 가능하게 해주어야 한다는 것이다.

숨가쁘게 비행기를 움직이는 것까지 진행해보았다.
다음은 미사일을 쏘는 것에 대해서 해보자.