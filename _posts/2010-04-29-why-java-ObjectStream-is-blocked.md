---
layout: post
title: Java ObjectStream의 Input/Ouput Blocking이야기
tags: java -pub
---

Java의 `ObjectInputStream` / `ObjectOutputStream`을 사용하여 데이터 통신을 할 때 Client와 Server 양측에서 `ObjectInputStream`을 먼저 생성하면 프로그램이 더이상 진행되지 않는 경우가 있는데, 그 이유는 다음과 같다.

`ObjectInputStream`의 ctor 코드를 보면 아래와 같이 `readStreamHeader();` 함수를 호출한다.  

```java
    public ObjectInputStream(InputStream in) throws IOException {
        verifySubclass();
        bin = new BlockDataInputStream(in);
        handles = new HandleTable(10);
        vlist = new ValidationList();
        enableOverride = false;
        readStreamHeader();
        bin.setBlockDataMode(true);
    }
```

`readStreamHeader()` 함수는 아래와 같다. 이는 bin이라는 멤버 변수를 사용하여 short값 2개를 읽는다.

```java
    protected void readStreamHeader()
        throws IOException, StreamCorruptedException
    {
        short s0 = bin.readShort();
        short s1 = bin.readShort();
```

그런데 bin이라는 녀석은 `BlockDataInputStream`이다.

```java
    /** filter stream for handling block data conversion */
    private final BlockDataInputStream bin;
```

이 때문에 양측에서 먼저 InputStream을 생성하면 둘다 short 값 2개를 서로 기다리다가 프로그램이 진행이 안되는 것.

이것을 해결하기 위해서 ObjectOutputStream을 먼저 생성하는데, 그 이유는 이와 같다.

`ObjectOutputStream`의 ctor를 보면, `writeStreamHeader();` 를 호출한다.

```java
    public ObjectOutputStream(OutputStream out) throws IOException {
        verifySubclass();
        bout = new BlockDataOutputStream(out);
        handles = new HandleTable(10, (float) 3.00);
        subs = new ReplaceTable(10, (float) 3.00);
        enableOverride = false;
        writeStreamHeader();
        bout.setBlockDataMode(true);
        if (extendedDebugInfo) {
            debugInfoStack = new DebugTraceInfoStack();
        } else {
            debugInfoStack = null;
        }   
    }
```

`writeStreamHeader();` 함수에서는 short값 2개를 `write`한다.

```java
    protected void writeStreamHeader() throws IOException {
        bout.writeShort(STREAM_MAGIC);
        bout.writeShort(STREAM_VERSION);
    }
```

이것이 바로 `ObjectInputStream`에서 기다리고 있는 `MAGIC_NUMBER`였던 것이다.

이와 같은 작용으로 인해 ObjectStream은 서로 Object를 주고받을 준비가 되었는지(양쪽다 ObjectStream인지) 확인하고 데이터를 주고 받을 수 있는 것이다.

### 결론 ###

* ObjectInputStream을 양쪽에서 먼저 생성하면 blocking,
* 따라서 ObjectOutputStream을 먼저 생성해줘야 stream에 값을 write 후, InputStream에서 읽을 수 있으므로 제대로 돌아간다.
