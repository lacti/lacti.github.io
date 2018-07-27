---
layout: post
title: 자바로 만드는 비행기 게임 3
tags: java game
---

이번에는 적기의 등장과 충돌검사를 해보자.

적기는, `y=0`에서 등장해서 `y=height`까지 진행한다. 즉, 화면 위쪽에서 아래쪽으로 일직선으로 진행하도록 하자. 그러면 진행하는 y 값은 항상 동일할테니까`(0 -> height)` 시작과 끝 x 값을 random으로 뽑으면 된다.

적기의 속도를 다양하게 한다고 한다면 원래 속도를 랜덤하게 구해서 그만큼씩 이동하게 하겠지만, 그렇게 계산해주기 귀찮으니까 등장 시간을 랜덤하게 뽑고(5초에서 10초 사이) 그 시간에 대해 랜덤한 시작좌표 ~ 끝좌표를 토대로 매 tick(100ms)마다 얼마나 이동하면 될지 delta를 구한다.

```java
class EnemyPos {
    Point2D delta, current;
    public EnemyPos(int shipHeight) {
        Random rand = new Random();
        float lifetime = rand.nextFloat() * 50 + 50;
        int startX = rand.nextInt(640);
        int endX = rand.nextInt(640);
        delta = new Point2D.Float((endX - startX) / lifetime, (480 + shipHeight * 2) / lifetime);
        current = new Point2D.Float(startX, -1 * shipHeight);
    }
}
```

그러면 매 tick마다 current는 delta만큼 더해주면 된다. 시작 y와 끝 y는 적기가 완전히 지나갈 수 있도록 비행기 그림의 height만큼씩 더 고려해주었다.

적기를 만들어주는 것도 여러 고려할 것이 있겠지만, 귀찮으니까 랜덤한 시간으로 만들어준다. 일단 `spawnTick`이라는걸 두어서, 현재 시간이 `spawnTick`을 넘어갈 때만 적기를 만들고, 그 후 `spawnTick`을 랜덤하게 갱신한다.

```java
private long spawnTick = 0;
private void generateEnemy() {
    if (spawnTick < System.currentTimeMillis()) {
        spawnTick = System.currentTimeMillis() + new Random().nextInt(2000) + 500;
        enemies.add(new EnemyPos(enemy.getHeight(this)));
    }
}
```

이제 매 Tick마다 적기가 움직일 수 있도록 위치 갱신을 해준다. 적기는 +y 방향으로 진행하며, 대충 화면 크기 height가 480 이니까 560정도 지나갈 때 비행기를 없애준다.

```java
private void updateEnemyPos() {
    Iterator<EnemyPos> iterator = enemies.iterator();
    while (iterator.hasNext()) {
        EnemyPos pos = iterator.next();
        pos.current.setLocation(pos.current.getX() + pos.delta.getX(), 
                pos.current.getY() + pos.delta.getY());
        if (pos.current.getY() > 560)
            iterator.remove();
    }
}
```

미리 매 tick마다 얼마나 움직일 지 계산해놨으니까, 현재의 위치는 거기서 더해주기만 하면 된다.

이제 적기도 그려주자. `paint` 함수에 현재 존재하는 적기들을 그려주도록 하면 된다.

```java
for (EnemyPos enemyPos: enemies) {
    g.drawImage(enemy, (int) enemyPos.current.getX() - enemy.getWidth(this) / 2,
        (int) enemyPos.current.getY() - enemy.getHeight(this) / 2, this);
}
```

이제 랜덤한 시간에 랜덤한 위치로 적기가 생성되어서 +y 방향으로 진행하는 것을 볼 수 있다.

여기까지 코드는 다음과 같다.

```java
import java.util.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.geom.*;
import javax.swing.*;
public class Tatieul extends JPanel implements KeyListener, ActionListener {
    private Point shipPos = new Point(320, 400);
    private Image ship, enemy;
    private ArrayList<Point> bullets = new ArrayList<Point>();
    private ArrayList<EnemyPos> enemies = new ArrayList<EnemyPos>();
    private long spawnTick = 0;
    public Tatieul() {
        setPreferredSize(new Dimension(640, 480));
        setFocusable(true);
        addKeyListener(this);
        ship = Toolkit.getDefaultToolkit().getImage("player.png");
        enemy = Toolkit.getDefaultToolkit().getImage("enemy.png");
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
        updateEnemyPos();
        updateBullets();
        generateEnemy();
        repaint();
    }
    private void generateEnemy() {
        if (spawnTick < System.currentTimeMillis()) {
            spawnTick = System.currentTimeMillis() + new Random().nextInt(2000) + 500;
            enemies.add(new EnemyPos(enemy.getHeight(this)));
        }
    }
    private void updateEnemyPos() {
        Iterator<EnemyPos> iterator = enemies.iterator();
        while (iterator.hasNext()) {
            EnemyPos pos = iterator.next();
            pos.current.setLocation(pos.current.getX() + pos.delta.getX(), 
                    pos.current.getY() + pos.delta.getY());
            if (pos.current.getY() > 560)
                iterator.remove();
        }
    }
    private void updateBullets() {
        Iterator<Point> iterator = bullets.iterator();
        while (iterator.hasNext()) {
            Point bullet = iterator.next();
            bullet.y -= 20;
            if (bullet.y < 0)
                iterator.remove();
        }
    }
    public void keyReleased(KeyEvent e) {}
    public void keyTyped(KeyEvent e) {}
    public void paintComponent(Graphics g) {
        g.setColor(Color.white);
        g.fillRect(0, 0, 640, 480);
        g.drawImage(ship, shipPos.x - ship.getWidth(this) / 2, shipPos.y - ship.getHeight(this) / 2, this);
        for (EnemyPos enemyPos: enemies) {
            g.drawImage(enemy, (int) enemyPos.current.getX() - enemy.getWidth(this) / 2,
                (int) enemyPos.current.getY() - enemy.getHeight(this) / 2, this);
        }
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
class EnemyPos {
    Point2D delta, current;
    public EnemyPos(int shipHeight) {
        Random rand = new Random();
        float lifetime = rand.nextFloat() * 50 + 50;
        int startX = rand.nextInt(640);
        int endX = rand.nextInt(640);
        delta = new Point2D.Float((endX - startX) / lifetime, (480 + shipHeight * 2) / lifetime);
        current = new Point2D.Float(startX, -1 * shipHeight);
    }
}
```

적기도 총알을 쏴야한다. 하지만 지금까지 총알은 모두 -y 방향(플레이어가 쐈을 때)만 고려되어서 만들어져있다. 따라서 총알도 방향 정보가 추가되어야 한다.

```java
class Bullet {
    Point pos;
    int direction;
    public Bullet(int x, int y, int direction) {
        this.pos = new Point(x, y);
        this.direction = direction;
    }
}
```

이에 따라 기존에 총알을 관리하던 코드가 바뀌어야 한다. 플레이어는 -y 방향으로 쏘니까 direction 값이 - 가 될테고, 이를 저장하는 List 는 Point 가 아닌 Bullet 을 가져야할테고, 그림 그리는 곳과 총알이 사라지는 곳까지 다 고쳐주면 된다.

```java
private ArrayList<Bullet> bullets = new ArrayList<Bullet>();
public void keyPressed(KeyEvent e) {
    switch (e.getKeyCode()) {
    case KeyEvent.VK_SPACE: bullets.add(new Bullet(shipPos.x, shipPos.y, -1)); break;
    }
    repaint();
}

private void updateBullets() {
    Iterator<Bullet> iterator = bullets.iterator();
    while (iterator.hasNext()) {
        Bullet bullet = iterator.next();
        bullet.pos.y += bullet.direction * 20;
        if ((bullet.direction < 0 && bullet.pos.y < 0)
                || (bullet.direction > 0 && bullet.pos.y > 560))
            iterator.remove();
    }
}

public void paintComponent(Graphics g) {
    g.setColor(Color.black);
    for (Bullet bullet: bullets)
        g.drawLine(bullet.pos.x, bullet.pos.y, bullet.pos.x, bullet.pos.y - 4);
}
```

적기가 총알을 쏴야한다. 간단하게 각 적기가 매 tick마다 random 돌려서 0.3보다 작은 값이 나오면 총알을 만들도록 하자-_-

```java
private void generateEnemyBullet() {
    for (EnemyPos enemyPos: enemies) {
        if (Math.random() < 0.2) {
            bullets.add(new Bullet((int) enemyPos.current.getX(), 
                    (int) enemyPos.current.getY(), 1));
        }
    }
}
```

이제 충돌검사를 구현한다. 본 게임에서는 간단하게 3가지 충돌검사만 구현해보자.

1. 총알간의 충돌검사
2. 총알과 비행기의 충돌검사
3. 비행기간의 충돌검사

그런데 비행기가 적기와 플레이어의 비행기로 2종류가 있으니 총 5가지 항목에 대해서 검사를 해야한다.
먼저 매 tick마다 총알간 충돌 검사를 하자.

```java
Set<Bullet> removeBulletSet = new HashSet<Bullet>();
for (int i = 0; i < bullets.size() - 1; ++i) {
    for (int j = i + 1; j < bullets.size(); ++j) {
        Bullet lhs = bullets.get(i), rhs = bullets.get(j);
        if (Math.abs(lhs.pos.x - rhs.pos.x) < 8 && Math.abs(lhs.pos.y - rhs.pos.y) < 20) {
            removeBulletSet.add(lhs);
            removeBulletSet.add(rhs);
        }
    }
}
for (Bullet removal: removeBulletSet) 
    bullets.remove(removal);
```

너무 치밀하게 충돌 검사를 하면 탄막놀이가 힘들어지니까 후하게 x범위 4, y범위 10으로 주자-_-

대충하는 건 좋은데 문제가 생겼다. space 키를 누르고 있으면 그 총알들이 겹쳐서 다 충돌처리가 되어버린다. 이 문제를 없애기 위해 shot delay를 준다.

```java
private long shotTick = 0;
private void playerShot() {
    if (shotTick < System.currentTimeMillis()) {
        shotTick = System.currentTimeMillis() + 200;
        bullets.add(new Bullet(shipPos.x, shipPos.y, -1));
    }
}
```

그리고 나머지 충돌 처리도 한다. 적기와 플레이어의 비행기는 영역을 갖는 `Rectangle`이므로 `Rectangle`의 `intersect` 함수를 쓰면 간단하다.

```java
private void checkCollision() {
    Set<Bullet> removeBulletSet = new HashSet<Bullet>();
    Set<EnemyPos> removeEnemySet = new HashSet<EnemyPos>();
    int shipWidth = ship.getWidth(this), shipHeight = ship.getHeight(this);
    int enemyWidth = enemy.getWidth(this), enemyHeight = enemy.getHeight(this);
    for (int i = 0; i < bullets.size() - 1; ++i) {
        for (int j = i + 1; j < bullets.size(); ++j) {
            Bullet lhs = bullets.get(i), rhs = bullets.get(j);
            if (Math.abs(lhs.pos.x - rhs.pos.x) < 8 && Math.abs(lhs.pos.y - rhs.pos.y) < 20) {
                removeBulletSet.add(lhs);
                removeBulletSet.add(rhs);
            }
        }
    }
    Rectangle2D shipRect = new Rectangle2D.Double(shipPos.x - shipWidth / 2, 
            shipPos.y - shipHeight / 2, shipWidth, shipHeight);
    for (Bullet bullet: bullets) {
        for (EnemyPos enemyPos: enemies) {
            if (Math.abs(enemyPos.current.getX() - bullet.pos.x) < enemyWidth 
                    && Math.abs(enemyPos.current.getY() - bullet.pos.y) < enemyHeight) {
                removeEnemySet.add(enemyPos);
                removeBulletSet.add(bullet);
            }
        }
        if (Math.abs(shipPos.x - bullet.pos.x) < shipWidth
                && Math.abs(shipPos.y - bullet.pos.y) < shipHeight) {
            removeBulletSet.add(bullet);
        }
    }
    for (int i = 0; i < enemies.size() - 1; ++i) {
        EnemyPos lhs = enemies.get(i);
        Rectangle2D lhsRect = new Rectangle2D.Double(lhs.current.getX() - enemyWidth / 2, 
                lhs.current.getY() - enemyHeight / 2, enemyWidth, enemyHeight);
        for (int j = i + 1; j < enemies.size(); ++j) {
            EnemyPos rhs = enemies.get(j);
            Rectangle2D rhsRect = new Rectangle2D.Double(rhs.current.getX() - enemyWidth / 2, 
                    rhs.current.getY() - enemyHeight / 2, enemyWidth, enemyHeight);
            if (lhsRect.intersects(rhsRect)) {
                removeEnemySet.add(lhs);
                removeEnemySet.add(rhs);
            }
        }
        if (lhsRect.intersects(shipRect)) {
            removeEnemySet.add(lhs);
        }
    }
    for (Bullet removal: removeBulletSet) 
        bullets.remove(removal);
    for (EnemyPos removal: removeEnemySet)
        enemies.remove(removal);
}
```

엄청나게 대충 작성한 결과로 적기가 자신이 쏜 총알에 맞아 사망하는 놀라운 일이 발생했다-_-;

여기까지 코드 전문은 다음과 같다.

```java
import java.util.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.geom.*;
import javax.swing.*;
public class Tatieul extends JPanel implements KeyListener, ActionListener {
    private Point shipPos = new Point(320, 400);
    private Image ship, enemy;
    private ArrayList<Bullet> bullets = new ArrayList<Bullet>();
    private ArrayList<EnemyPos> enemies = new ArrayList<EnemyPos>();
    private long spawnTick = 0;
    private long shotTick = 0;
    public Tatieul() {
        setPreferredSize(new Dimension(640, 480));
        setFocusable(true);
        addKeyListener(this);
        ship = Toolkit.getDefaultToolkit().getImage("player.png");
        enemy = Toolkit.getDefaultToolkit().getImage("enemy.png");
        new javax.swing.Timer(100, this).start();
    }
    public void keyPressed(KeyEvent e) {
        switch (e.getKeyCode()) {
        case KeyEvent.VK_UP:    shipPos.y -= 10; break;
        case KeyEvent.VK_DOWN:  shipPos.y += 10; break;
        case KeyEvent.VK_LEFT:  shipPos.x -= 10; break;
        case KeyEvent.VK_RIGHT: shipPos.x += 10; break;
        case KeyEvent.VK_SPACE: playerShot(); break;
        }
        repaint();
    }
    private void playerShot() {
        if (shotTick < System.currentTimeMillis()) {
            shotTick = System.currentTimeMillis() + 200;
            bullets.add(new Bullet(shipPos.x, shipPos.y - (ship.getHeight(this) / 2 + 8), -1));
        }
    }
    public void actionPerformed(ActionEvent e) {
        updateEnemyPos();
        updateBullets();
        checkCollision();
        generateEnemy();
        generateEnemyBullet();
        repaint();
    }
    private void checkCollision() {
        Set<Bullet> removeBulletSet = new HashSet<Bullet>();
        Set<EnemyPos> removeEnemySet = new HashSet<EnemyPos>();
        int shipWidth = ship.getWidth(this), shipHeight = ship.getHeight(this);
        int enemyWidth = enemy.getWidth(this), enemyHeight = enemy.getHeight(this);
        for (int i = 0; i < bullets.size() - 1; ++i) {
            for (int j = i + 1; j < bullets.size(); ++j) {
                Bullet lhs = bullets.get(i), rhs = bullets.get(j);
                if (Math.abs(lhs.pos.x - rhs.pos.x) < 8 && Math.abs(lhs.pos.y - rhs.pos.y) < 20) {
                    removeBulletSet.add(lhs);
                    removeBulletSet.add(rhs);
                }
            }
        }
        Rectangle2D shipRect = new Rectangle2D.Double(shipPos.x - shipWidth / 2, 
                shipPos.y - shipHeight / 2, shipWidth, shipHeight);
        for (Bullet bullet: bullets) {
            for (EnemyPos enemyPos: enemies) {
                if (Math.abs(enemyPos.current.getX() - bullet.pos.x) < enemyWidth 
                        && Math.abs(enemyPos.current.getY() - bullet.pos.y) < enemyHeight) {
                    removeEnemySet.add(enemyPos);
                    removeBulletSet.add(bullet);
                }
            }
            if (Math.abs(shipPos.x - bullet.pos.x) < shipWidth
                    && Math.abs(shipPos.y - bullet.pos.y) < shipHeight) {
                removeBulletSet.add(bullet);
            }
        }
        for (int i = 0; i < enemies.size() - 1; ++i) {
            EnemyPos lhs = enemies.get(i);
            Rectangle2D lhsRect = new Rectangle2D.Double(lhs.current.getX() - enemyWidth / 2, 
                    lhs.current.getY() - enemyHeight / 2, enemyWidth, enemyHeight);
            for (int j = i + 1; j < enemies.size(); ++j) {
                EnemyPos rhs = enemies.get(j);
                Rectangle2D rhsRect = new Rectangle2D.Double(rhs.current.getX() - enemyWidth / 2, 
                        rhs.current.getY() - enemyHeight / 2, enemyWidth, enemyHeight);
                if (lhsRect.intersects(rhsRect)) {
                    removeEnemySet.add(lhs);
                    removeEnemySet.add(rhs);
                }
            }
            if (lhsRect.intersects(shipRect)) {
                removeEnemySet.add(lhs);
            }
        }
        for (Bullet removal: removeBulletSet) 
            bullets.remove(removal);
        for (EnemyPos removal: removeEnemySet)
            enemies.remove(removal);
    }
    private void updateEnemyPos() {
        Iterator<EnemyPos> iterator = enemies.iterator();
        while (iterator.hasNext()) {
            EnemyPos pos = iterator.next();
            pos.current.setLocation(pos.current.getX() + pos.delta.getX(), 
                    pos.current.getY() + pos.delta.getY());
            if (pos.current.getY() > 560)
                iterator.remove();
        }
    }
    private void updateBullets() {
        Iterator<Bullet> iterator = bullets.iterator();
        while (iterator.hasNext()) {
            Bullet bullet = iterator.next();
            bullet.pos.y += bullet.direction * 20;
            if ((bullet.direction < 0 && bullet.pos.y < 0)
                    || (bullet.direction > 0 && bullet.pos.y > 560))
                iterator.remove();
        }
    }
    private void generateEnemy() {
        if (spawnTick < System.currentTimeMillis()) {
            spawnTick = System.currentTimeMillis() + new Random().nextInt(2000) + 500;
            enemies.add(new EnemyPos(enemy.getHeight(this)));
        }
    }
    private void generateEnemyBullet() {
        for (EnemyPos enemyPos: enemies) {
            if (Math.random() < 0.2) {
                bullets.add(new Bullet((int) enemyPos.current.getX(), 
                        (int) enemyPos.current.getY() + (enemy.getHeight(this) / 2 + 8), 1));
            }
        }
    }
    public void keyReleased(KeyEvent e) {}
    public void keyTyped(KeyEvent e) {}
    public void paintComponent(Graphics g) {
        g.setColor(Color.white);
        g.fillRect(0, 0, 640, 480);
        g.drawImage(ship, shipPos.x - ship.getWidth(this) / 2, shipPos.y - ship.getHeight(this) / 2, this);
        for (EnemyPos enemyPos: enemies) {
            g.drawImage(enemy, (int) enemyPos.current.getX() - enemy.getWidth(this) / 2, 
                    (int) enemyPos.current.getY() - enemy.getHeight(this) / 2, this);
        }
        g.setColor(Color.black);
        for (Bullet bullet: bullets)
            g.drawLine(bullet.pos.x, bullet.pos.y, bullet.pos.x, bullet.pos.y - 4);
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
class EnemyPos {
    Point2D delta, current;
    public EnemyPos(int shipHeight) {
        Random rand = new Random();
        float lifetime = rand.nextFloat() * 50 + 50;
        int startX = rand.nextInt(640);
        int endX = rand.nextInt(640);
        delta = new Point2D.Float((endX - startX) / lifetime, (480 + shipHeight * 2) / lifetime);
        current = new Point2D.Float(startX, -1 * shipHeight);
    }
}
class Bullet {
    Point pos;
    int direction;
    public Bullet(int x, int y, int direction) {
        this.pos = new Point(x, y);
        this.direction = direction;
    }
}
```

억지로 한 파일에 최대한 짧고 대충 짜려다보니 코드가 개판이 되었다. 여러 이슈가 있겠지만, 일단 다음번에는 저걸 보다 구조화하는 작업을 해보도록 하자. (안 그러면 코드가 너무 더러워서 도저히 진행을 못할 것 같다-_-)