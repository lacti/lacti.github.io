---
layout: post
title: 간단한 Message 체계 구현 (Java)
tags: java message -pub
---

본 글을 객체 간의 메시지 통신이 아니라 모듈 간의 메시지 통신에 대해 다룬다.
즉, 특정 대상 객체를 지정하여 메시지를 보내는 내용이 아니라 전역 MessageQueue에 대해 어떤 Message를 수신할지를 등록하는 Handler 객체에 대한 내용이다.

* `MessageQueue`는 전역 객체이다. `Message`를 받아서 이를 수신 Handler 객체에게 전달한다.
* 여러 Thread에서 접근할 수 있으므로 Concurrent DataStructure를 사용한다.
* 내부적으로 각 Message 에 대해 여러 Worker Thread 를 두어 처리할 수도 있겠지만, 일단 Message 처리의 순서를 보장하기 위해 공유 Queue 를 갖고 단일 Thread 가 처리하는 방식으로 구현한다.  
  (글 쓰면서 생각해보니 이 지점에서 성능 병목이 생길텐데, 고민을 더 해봐야겠다)

`Message`는 무슨 class 가 될지 모르니까 간단하게 mark interface로 만든다.

```java
public interface Message {
}
```

`MessageQueue` class는 Message를 공유하는 Queue 객체와 이를 처리할 수 있도록 내부 Thread를 하나 돌린다.

```java
private BlockingQueue<Message> queue = new LinkedBlockingQueue<Message>(); 

private MessageQueue() {
    new Thread() {
        /* public this() */ {
            setDaemon(true);
        }
        
        @Override
        public void run() {
            process();
        }
    }.start();
}

private void process() {
    Message message = null;
    while ((message = pop()) != null) {
        delegate(message);
    }
}

private Message pop() {
    try {
        return queue.take();
    } catch (InterruptedException e) {
        Logger.error(e);
    }
    return null;
}
```

보통의 단순한 Message Handler라면, Message에 MessageType이나 id 값을 넣어서 그 내부적으로 switch case로 분기하여 처리하는 구조가 될 것이다. 이에 대해서는 multiple-dispatch를 사용하면 보다 깔끔한 구조의 Handler를 작성할 수 있는데, Java는 어차피 느리니 Reflection을 통해 이 기능을 구현해보자.

Handler는 `handleMessage`이라는 method를 갖는다. 이 때 parameter는 `Message` class를 하나만 갖는다.

```java
void handleMessage(StringMessage message) {
}
void handleMessage(IntMessage message) {
}
```

이 때 `MessageQueue`에 `StringMessage` 객체를 넣으면 첫 번째 함수가, `IntMessage` 객체를 넣으면 후자의 함수가 호출되도록 하겠다는 것이다.

```java
private static final String HANDLER_NAME = "handleMessage";
private Map<Class<?>, List<Object>> handlerMap = new ConcurrentHashMap<Class<?>, List<Object>>();

private void addHandler(Object handler) {
    Class<?> handlerClass = handler.getClass();
    for (Method method: handlerClass.getDeclaredMethods()) {
        if (!method.getName().equals(HANDLER_NAME))
            continue;
        
        Class<?>[] paramTypes = method.getParameterTypes();
        Class<?> messageClass = paramTypes[0];
        if (!Message.class.isAssignableFrom(messageClass) || paramTypes.length > 1) {
            Logger.error(new MessageQueueException("Invalid Handler in " + handlerClass.getSimpleName() 
                    + "/" + method.toGenericString()));
            
            continue;
        }
        
        if (!handlerMap.containsKey(messageClass)) {
            handlerMap.put(messageClass, new CopyOnWriteArrayList<Object>());
        }
        handlerMap.get(messageClass).add(handler);
    }
}
```

Handler 객체를 등록할 때, Handler 객체에 선언된 모든 Method를 가져온다. 그 Method 중 이름이 `handleMessage`인 것들을 찾는다. 이 때 parameter는 반드시 한 개이어야 하고, 그 type은 `Message` class를 상속받는 class이어야(`assignableFrom`) 한다.

그러한 method들을 찾았다면, 그 `Message` class에 대응되는 Handler들의 목록을 저장해둔다. (여기서 Method도 같이 저장해둔다면, 나중에 invoke할 때 또 Method를 찾는 부담을 덜 수 있을 것이다.)

이제 `Message`가 들어오면 그 class type에 해당하는 Handler를 찾아서 invoke를 해주면 된다.

```java
private void delegate(Message message) {
    Set<Object> invoked = new HashSet<Object>();
    
    Class<?> clazz = message.getClass();
    while (!clazz.equals(Object.class)) {
        if (handlerMap.containsKey(clazz)) {
            for (Object handler: handlerMap.get(clazz)) {
                // prevent bubbling
                if (!invoked.contains(handler)) {
                    invoke(handler, clazz, message);
                    invoked.add(handler);
                }
            }
        }
        
        clazz = clazz.getSuperclass();
    }
    
    if (invoked.isEmpty()) {
        Logger.error(new MessageQueueException("Cannot Find MessageHandler(" + message.getClass().getName() + ")"));
    }
}

private void invoke(Object handler, Class<?> messageClass, Message message) {
    Class<?> handlerClass = handler.getClass();
    try {
        Method method = handlerClass.getDeclaredMethod(HANDLER_NAME, messageClass);
        method.setAccessible(true);
        method.invoke(handler, message);
        
    } catch (Exception e) {
        Logger.error(e);
    }
}
```

다만, bubbling을 막기 위해서 한 번 Invoke된 Handler는 다시 Invoke되지 않도록 했다. 예를 들어서,

```java
class StringMessage implements Message {}
class SpecialStringMessage extends StringMessage {}
void handleMessage(StringMessage message) {}
void handleMessage(SpecialStringMessage message) {}
```

`SpecialStringMessage` 객체를 전달했을 때 원하는 상황은 두 번째 함수가 호출되는 것이겠지만, 사실 `SpecialStringMessage` class는 `StringMessage` class로 assignable하기 때문에 첫 번째 함수도 호출될 수 있다.

따라서 delegate 함수에서는 처리할 Message type을 가장 구체화된(derived) type부터 역순으로 올라가면서, 그 type 에 대응되는 Handler를 호출해준 뒤, 더 이상 호출되지 않도록 invoked set을 유지하는 것이다.

invoke를 할 때 굳이 `setAccessible`을 true 해주는 이유는, message handler 함수가 굳이 객체 외부에서 불릴 필요가 없는데 public으로만 선언되어야 하는 것을 막기 위함이다. (물론 그렇다고 private으로 선언하면 해당 handler는 *not read locally warning*이 발생하게 되므로, 안타깝지만 default 정도로 선언해주는게 적당한 것 같다)

작성된 `MessageQueue`는 다음과 같이 사용될 수 있다.

```java
void handleMessage(StringMessage message) {
    System.out.println(message.getMessage());
}

void handleMessage(IntMessage message) {
    System.out.println(message.getValue());
}

public static void main(String[] args) {
    MessageQueue.listen(new ExampleHandler());
    MessageQueue.push(new StringMessage("hello world"));
    MessageQueue.push(new IntMessage(12345));
    
    try {
        Thread.sleep(1000);
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
}
```

`IntMessage` class는 int를 생성자로 받고 `StringMessage` class는 String을 생성자로 받는 단순한 wrapper class이다. `MessageQueue`에 `ExampleHandler` 객체를 등록하고 각 type의 message 객체를 넣으면, 첫 번째는 `StringMessage` parameter type을 갖는 handler가, 두 번째는 `IntMessage` parameter type을 갖는 handler가 호출된다.

(마지막의 `Thread.sleep`은 daemon Thread로 `Message`를 처리하는 `MessageQueue`가 Queue에 있는 Message를 처리하기 전에 main 함수가 끝나 프로그램이 종료되어 Message 처리가 되지 못하는 것을 막기 위함이다)