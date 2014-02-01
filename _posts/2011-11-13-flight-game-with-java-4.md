---
layout: post
title: 자바로 만드는 비행기 게임 4
tags: java game -pub
---

이번과 다음은 코드 정리를 해보자.

이전까지의 비행기 게임 코드는 너무 하나의 class 에서 다 처리하는 방식으로, 뭐 하나 수정하기도 좋지 못한 구조였다 (물론 코드 전체가 별로 안 기니까 크게 상관없겠지만)

예를 들어 적기의 종류를 새로 추가한다던가, 총알의 종류를 새로 추가한다던가 하는 것이 쉽지 않은 코드였다. 따라서 이번에는 간단하게 코드를 묶으면서 정리를 해보자.

### resource 정리 ###

현재 게임에서 사용되고 있는 resource는 player의 ship image와 enemy의 ship image이다. 그리고 그것들은 모두 `java.awt.Image` 형식으로 특정 정보를 가져올 때마다 `ImageObserver`(`MediaTracker`)를 걸어주는 구조로, 미리 모두 메모리에 올려두는 것과는 좀 다른 방식이다.

어차피 게임이 한 번 떠서 끝날 때까지 resource를 내릴 필요가 없으므로, 모든 정보가 메모리에 올라가있는 `java.awt.BufferedImage`를 사용하여 resource를 관리하자. 먼저 resource의 type을 정의하자.

```java
enum ResourceType {
    ENEMY_SHIP, PLAYER_SHIP
}
```

이제 이 type에 대해 `BufferedImage`를 갖는 `ResourceManager` class를 만들자.
이 `ResourceManager` class는 게임 전체에 딱 하나만 존재하면 되므로 singleton을 사용한다.

```java
class ResourceManager {
    static ResourceManager instance = new ResourceManager();
    public static ResourceManager getInstance() {
        return instance;
    }
    private Map<ResourceType, BufferedImage> imageMap = new HashMap<ResourceType, BufferedImage>();
    private ResourceManager() {
        try {
            imageMap.put(ResourceType.ENEMY_SHIP, ImageIO.read(getClass().getResource("enemy.png")));
            imageMap.put(ResourceType.PLAYER_SHIP, ImageIO.read(getClass().getResource("player.png")));
        } catch (IOException e) {
            System.err.println("Cannot load resources");
            System.exit(0);
        }
    }
    public BufferedImage getImage(ResourceType type) {
        return imageMap.get(type);
    }
}
```

객체가 생성될 때 `javax.imageio.ImageIO` class의 helper function을 사용하여 png 파일을 읽는다. 이 때 굳이 파일을 절대 경로로 주지 않고 `ClassLoader`의 `getResource` 함수를 이유는 해당 png 파일을 project 내에 포함시켜서 하나의 jar로 배포할 때도 동작하게 하기 위함이다. (따라서 eclipse로 관리되는 프로젝트 환경에서 위와 같이 쓰려면 해당 png 파일을 project 디렉토리가 아닌 src 디렉토리에 넣어주어야 한다.)

생성자를 private로 만들어서 다른 곳에서의 생성을 막았고, static 함수로 `ResourceManager` class의 단일 객체를 반환하도록 하여 간단히 singleton을 구현하였다.

### game object 정리 ###

그리고 모든 게임 내의 물체에 대한 추상 class를 만들자. `GameObject`라고 부를 이 class는 자신의 고유 id 와 충돌 영역을 갖고, 매 tick 마다 어떻게 갱신(`update`)할지, 그리고 어떻게 그려져야할 지(`paint`)에 대한 interface 를 갖는다.

```java
abstract class GameObject {
    private static long idSerial = 0;
    
    protected long id = ++idSerial;
    protected long creationTick = System.currentTimeMillis();
    protected Point2D location = new Point2D.Float();
    protected int width, height;
    public GameObject(int width, int height) {
        this.width = width;
        this.height = height;
    }
    public void setLocation(float x, float y) {
        this.location.setLocation(x, y);
    }
    protected Rectangle2D getBound() {
        return new Rectangle2D.Float((float) location.getX(), (float) location.getY(), width, height);
    }
    public boolean check(GameObject other) {
        if (this == other)
            return false;
        return getBound().intersects(other.getBound());
    }
    public long getId() {
        return id;
    }
    public int getHeight() {
        return height;
    }
    public int getWidth() {
        return width;
    }
    public abstract void paint(Graphics2D g2d);
    public abstract void update();
    public abstract boolean isOutOfScreen(int screenWidth, int screenHeight);
}
```

* id는 순차적으로 발급하면 되므로 static 변수의 값을 증가시키면서 얻는다.  
  이는 추후 총알과 비행기의 충돌검사를 할 때, 자기가 쏜 총알에는 안 맞도록 처리하기 위해 사용된다.
* 공용적으로 갖게 되는 위치(`location`) 정보와 가로, 세로 길이(`width`, `height`)를 바탕으로 충돌 영역을 반환하는 함수를 가지고 있다(`getBound`).
* 충돌 영역을 계산할 수 있다면, 충돌 검사 함수(`check`)에서는 단순히 두 `java.awt.geom.Rectangle2D` class의 `intersect` 함수를 통해 영역이 겹쳐졌나 확인해볼 수 있다.  
  (물론 이는 XNA의 bitmap check 같은 방식은 아니라서 그냥 간단한 사각형 충돌 처리밖에 안된다, 더 자세히 하려면 `PathIterator` 같은 것을 써서 `Polygon`을 구성해서 하면 될 것이다)
* 그리고 갱신(`update`), 그리기(`paint`)에 대한 interface 를 갖는다.
* 화면 밖으로 사라졌는지(`isOutOfScreen`)에 대한 interface는 `update` 후 자신이 화면 밖으로 나갔다는 것을 판단해서 해당 객체를 없애기 위함이다.

미리 말하자면 위 구조는 별로 깔끔하지 않다. 이는 #5에서 수정할 예정이다.

#### ship 정리 ####

이제 이 class를 상속받아 `Ship`에 대한 기본 class를 만들어보자. `Ship` class는 `Enemy` class와 `Player` class가 상속받게 되는 class로, 어떤 ship image를 갖고, 그것을 어떻게 그리는지를 명시한다.

```java
abstract class Ship extends GameObject {
    private BufferedImage image;
    public Ship(BufferedImage image) {
        super(image.getWidth(), image.getHeight());
        this.image = image;
    }
    public void paint(Graphics2D g2d) {
        int x = (int) Math.round(location.getX() - width / 2);
        int y = (int) Math.round(location.getY() - height / 2);
        g2d.drawImage(image, x, y, null);
    }
    @Override
    protected Rectangle2D getBound() {
        return new Rectangle2D.Float((float) location.getX() - width / 2,
                (float) location.getY() - height / 2, width, height);
    }
}
```

`Ship` class는 어떤 image 기반으로 동작할지 생성자로 Image에 대한 정보를 받는다. 그리고 그 image 를 `paint` 함수에서 그려준다. 이 때 현재 비행기의 위치를 그림의 중앙으로 보정하기 때문에 width / 2, height / 2 를 빼게 된다. 이 때문에 충돌 영역이 바뀌게 되므로 (기존 충돌 영역은 그냥 x, y 였으니까) 충돌 영역을 고쳐서 반환할 수 있도록 해준다.

#### bullet 정리 ####

총알에 대한 class를 만든다.

```java
class Bullet extends GameObject {
    public static final int PLAYER = -1;
    public static final int ENEMY = 1;
    private static final int WIDTH = 2;
    private static final int HEIGHT = 5;
    private static final int BULLET_SPEED = 20;
    private int direction;
    private long ownerId;
    public Bullet(long ownerId, int direction) {
        super(WIDTH, HEIGHT);
        this.ownerId = ownerId;
        this.direction = direction;
    }
    @Override
    public boolean check(GameObject other) {
        if (this == other)
            return false;
        if (ownerId == other.getId())
            return false;
        return super.check(other);
    }
    @Override
    public void update() {
        location.setLocation(location.getX(), location.getY() + direction * BULLET_SPEED);
    }
    @Override
    public void paint(Graphics2D g2d) {
        g2d.setColor(Color.gray);
        g2d.fill(getBound());
    }
    @Override
    public boolean isOutOfScreen(int screenWidth, int screenHeight) {
        float minY = (float) location.getY() - height;
        float maxY = (float) location.getY() + height;
        switch (direction) {
        case PLAYER:
            return maxY < 0;
        case ENEMY:
            return minY > screenHeight;
        }
        return true;
    }
}
```

`Player`의 총알은 -y 방향으로 진행하고, `Enemy`의 총알은 +y 방향으로 진행하므로 이를 구분하는 값을 -1, 1 과 같이 정의하였다. (당연한 이야기이지만 이는 #5에서 수정될 구조이다. 딱 봐도 좋지 않다)

총알을 쏜 ship과는 충돌을 하면 안되므로 총알을 생성할 때 자신이 누구에 대한 총알인지 owner의 game object id를 받는다. 그래서 충돌 검사 함수를 override하여 owner id가 해당 game object의 id와 같다면 충돌 처리를 하지 않는다.

매 `update` 마다 지정된 속도로 총알이 이동할 수 있도록 한다. 그리고 일단 resource가 없으니까 간단하게 충돌 영역을 회색으로 칠해서 총알을 그려버린다.

화면에서 총알이 나갔을 때 총알을 메모리에서 없애버려야 하므로 방향에 따라 화면 이탈 여부를 고려해 `isOutOfScreen` 함수를 작성한다.

#### player 정리 ####

`Player`의 `Ship`은 방향 키에 따라 움직일 수 있다. 따라서 먼저 어떤 방향으로 움직일지에 대한 정보를 enum으로 만든다.

```java
enum MoveDirection {
    NONE, LEFT, RIGHT, UP, DOWN;
    public static MoveDirection fromKeyEvent(KeyEvent e) {
        switch (e.getKeyCode()) {
        case KeyEvent.VK_LEFT: return LEFT;
        case KeyEvent.VK_RIGHT: return RIGHT;
        case KeyEvent.VK_UP: return UP;
        case KeyEvent.VK_DOWN: return DOWN;
        }
        return NONE;
    }
}
```

어차피 방향은 `KeyEvent` 정보로부터 받게 되므로, enum 내에 `KeyEvent`로부터 enum 값을 반환하는 함수를 작성했다.

`Player`의 `Ship`은 사용자가 누른 Key에 대해서 움직이고, 총알을 쏠 수 있다.

```java
class Player extends Ship {
    private static final int BULLET_Y_POS_MARGIN = 8;
    private static final int SHOT_DELAY = 300;
    private static final int SPEED = 10;
    private long lastShotTick = 0;
    public Player() {
        super(ResourceManager.getInstance().getImage(ResourceType.PLAYER_SHIP));
    }
    @Override
    public void update() {
    }
    public void move(MoveDirection direction) {
        switch (direction) {
        case LEFT: location.setLocation(location.getX() - SPEED, location.getY()); break; 
        case RIGHT: location.setLocation(location.getX() + SPEED, location.getY()); break;
        case UP: location.setLocation(location.getX(), location.getY() - SPEED); break;
        case DOWN: location.setLocation(location.getX(), location.getY() + SPEED); break;
        }
    }
    public boolean canShot() {
        return (lastShotTick + SHOT_DELAY < System.currentTimeMillis());
    }
    public Bullet shot() {
        lastShotTick = System.currentTimeMillis();
        Bullet bullet = new Bullet(getId(), Bullet.PLAYER);
        bullet.setLocation((float) location.getX(), (float) location.getY() - height / 2 - BULLET_Y_POS_MARGIN);
        return bullet;
    }
    @Override
    public boolean isOutOfScreen(int screenWidth, int screenHeight) {
        return false;
    }
    public static Player create(int screenWidth, int screenHeight) {
        Player player = new Player();
        player.setLocation(screenWidth / 2, screenHeight * 2 / 3);
        return player;
    }
}
```

먼저 생성할 때 `ResourceManager`로부터 PlayerShip image resource를 가져와서 `Ship` class의 생성자로 넣어준다. `move` 함수에서는 어떤 방향으로 움직일 지에 대해 지정된 값으로 더해서 이동할 수 있도록 한다.

총알은 지정된 shot delay가 넘지 않았다면 쏠 수 없다. 따라서 `canShot` 함수에서 이 tick이 넘었는지 검사하고, shot 함수에서 총알을 만들어서 반환한다. (여기도 수정 대상이다)

`Player`는 매 tick마다 현재 해줄 일이 없으므로 `update` 함수는 그냥 비워둔다. `Player`를 만드는 `create` 함수가 static 으로 선언되어있는데, 현재는 별 의미 없는 함수이다.

#### enemy 정리 ####

마지막으로 적기에 대한 class를 만들어 보자.

```java
class Enemy extends Ship {
    private static final int SPAWN_BASE_TICK = 500;
    private static final int SPAWN_RANDOM_TICK = 2000;
    private static final int BULLET_Y_POS_MARGIN = 8;
    private static final int RANDOM_LIFETIME = 50;
    private static final int BASE_LIFETIME = 50;
    private static long spawnTick;
    
    private Point2D moveDelta = new Point2D.Float();
    public Enemy(Point2D location, Point2D moveDelta) {
        super(ResourceManager.getInstance().getImage(ResourceType.ENEMY_SHIP));
        this.location.setLocation(location);
        this.moveDelta.setLocation(moveDelta);
    }
    @Override
    public void update() {
        location.setLocation(location.getX() + moveDelta.getX(), 
                location.getY() + moveDelta.getY());
    }
    public boolean canShot() {
        return (Math.random() < 0.2);
    }
    public Bullet shot() {
        Bullet bullet = new Bullet(getId(), Bullet.ENEMY);
        bullet.setLocation((float) location.getX(), (float) location.getY() + height / 2 + BULLET_Y_POS_MARGIN);
        return bullet;
    }
    @Override
    public boolean isOutOfScreen(int screenWidth, int screenHeight) {
        float minX = (float) location.getX() - width / 2;
        float minY = (float) location.getY() - height / 2;
        return minX > screenWidth || minY > screenHeight;
    }
    public static boolean isSpawnable() {
        return spawnTick < System.currentTimeMillis();
    }
    public static Enemy spawn(int screenWidth, int screenHeight) {
        spawnTick = System.currentTimeMillis() + new Random().nextInt(SPAWN_RANDOM_TICK) + SPAWN_BASE_TICK;
        Random rand = new Random();
        int shipHeight = ResourceManager.getInstance().getImage(ResourceType.ENEMY_SHIP).getHeight();
        float lifetime = rand.nextFloat() * RANDOM_LIFETIME + BASE_LIFETIME;
        int startX = rand.nextInt(screenWidth);
        int endX = rand.nextInt(screenWidth);
        Point2D location = new Point2D.Float(startX, -1 * shipHeight);
        Point2D moveDelta = new Point2D.Float((endX - startX) / lifetime, (screenHeight + shipHeight * 2) / lifetime);
        return new Enemy(location, moveDelta);
    }
}
```

적기의 logic은 이전 코드에서 그대로 가져온 것으로, 처음 시작 위치(location)와 매 tick마다 update에서 더해줄 이동 값(`moveDelta`)을 생성자로 받는다.
이것도 역시 `canShot`과 `shot` 함수를 통해 총알을 발사하게 된다.

적기를 spawn하는 시점과 어떤 위치에서 적기를 만들지에 대한 함수를 static으로 갖는다.

### main 정리 ###

이제 main class를 정리해보자.
기존에는 각 type에 대한 List를 가지고 있었어야 했지만, 이제는 `GameObject`로 이루어진 container 하나만 있으면 된다.

```java
private Player player = Player.create(WIDTH, HEIGHT);
private List<GameObject> objects = new ArrayList<GameObject>();
```

대신, `Player`의 경우는 `move` 함수 등을 직접 조작해주어야 하니까 따로 reference를 갖는다. 하지만 이것도 `update` 함수나 `paint` 함수가 불리어야 하므로 `objects` 안에 넣어준다.

```java
public Tatieul() {
    setPreferredSize(new Dimension(WIDTH, HEIGHT));
    setFocusable(true);
    addKeyListener(this);
    new Timer(100, this).start();
    objects.add(player);
}
```

Key를 눌렀을 때는 `Player` 객체의 `move` 함수를 불러주면 된다. 단 `VK_SPACE` 를 눌렀다면 총알을 만들어서 `objects`에 넣어준다.

```java
public void keyPressed(KeyEvent e) {
    switch (e.getKeyCode()) {
    case KeyEvent.VK_UP:
    case KeyEvent.VK_DOWN:
    case KeyEvent.VK_LEFT:
    case KeyEvent.VK_RIGHT:
        player.move(MoveDirection.fromKeyEvent(e));
        break;
        
    case KeyEvent.VK_SPACE:
        if (player.canShot())
            objects.add(player.shot());
        break;
    }
    repaint();
}
```

매 tick마다는 모든 객체의 위치를 갱신하고, 충돌 검사를 하며, 적기를 만들어내는 코드는, 실제 수행하는 부분이 모두 각 class로 빠졌으므로 단순해진다.

```java
public void actionPerformed(ActionEvent e) {
    updateAll();
    checkCollision();
    generateEnemyAndBullet();
    repaint();
}
private void updateAll() {
    for (GameObject each: objects)
        each.update();
}
private void checkCollision() {
    Set<GameObject> removal = new HashSet<GameObject>();
    for (int i = 0; i < objects.size() - 1; ++i) {
        GameObject lhs = objects.get(i);
        for (int j = i + 1; j < objects.size(); ++j) {
            GameObject rhs = objects.get(j);
            if (!lhs.check(rhs)) continue;
            removal.add(lhs);
            removal.add(rhs);
            break;
        }
    }
    for (GameObject each: objects)
        if (each.isOutOfScreen(getWidth(), getHeight()))
            removal.add(each);
            
    for (GameObject each: removal)
        objects.remove(each);
}
private void generateEnemyAndBullet() {
    if (Enemy.isSpawnable())
        objects.add(Enemy.spawn(getWidth(), getHeight()));
    List<GameObject> bullets = new ArrayList<GameObject>();
    for (GameObject each: objects) {
        if (!(each instanceof Enemy))
            continue;
        Enemy enemy = (Enemy) each;
        if (enemy.canShot())
            bullets.add(enemy.shot());
    }
    objects.addAll(bullets);
}
```

모든 object의 `update`는 단순히 `objects`의 객체를 순회하면서 `update`를 불러주는 것으로 가능하다. 충돌 검사도, 각 case 마다 따로 순회하는 것이 아니라 `objects` 내의 원소들 간의 충돌을 검사해주는 식으로 통합되었다.

적기를 만드는 과정은 역시 static 함수를 호출해주는 것으로 가능한데, 적기의 총알을 만드는 것은 `GameObject`가 `Enemy` class일 때 그 enemy가 총알을 만들 수 있으면 일단 다른 container에 모아놨다가 순회가 끝난 후 `objects`에 넣어주는 방식이다.

* 그냥 `objects`를 순회하면서 생성되는 총알을 `objects`에 넣어버리면 당연한 이야기지만 `ConcurrentModificationException`이 발생한다. 어떤 container 를 순회하는 도중에는 그 container 를 수정(add/remove 등)을 할 수 없다
* 총알을 만드는 부분 역시 #5 에서의 리팩토링 대상이다

이 모든 것을 화면에 그려주는 것도 단순히 `objects`를 한 번 순회하면서 `paint`를 불러주면 그만이다.

```java
public void paintComponent(Graphics g) {
    Graphics2D g2d = (Graphics2D) g;
    g.setColor(Color.white);
    g.fillRect(0, 0, getWidth(), getHeight());
    for (GameObject each: objects)
        each.paint(g2d);
}
```

이 때 굳이 `Graphics2D` 객체로 `Graphics` 객체를 casting한 이유는 나중에 여러가지 것들을 써먹기 위함이다.

### 마무리 ###

간단하게 class를 쪼개고 묶음으로써 코드가 어느정도 정리가 되었다. (물론 덕분에 길어졌다)
코드 내에 박혀있는 숫자를 상수로 바꾸고, class 를 분할하다 보면 어떤 기능이 어느 지점에 추가해야할지 보다 명확히 보일 수 있으므로 그러한 습관을 들이면서 코딩 연습을 하는 것이 좋다.

미리 예고 했던 대로 #5 까지는 좀 더 리팩토링을 진행하고, #6 부터 키 입력 개선, 미사일 다양화 등 게임 컨텐츠에 집중해보도록 하겠다.