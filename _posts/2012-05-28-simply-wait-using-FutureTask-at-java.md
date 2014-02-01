---
layout: post
title: java의 FutureTask를 사용한 간단한 수행 대기
tags: java -pub
---

어떤 작업에 timeout을 주고 실행하고 싶은 경우가 있다. 예를 들어 web crawler를 만들 때에는 해당 페이지에 대한 응답이 10초정도 없을 경우에 그냥 그 페이지를 읽지 않도록 예외처리 하는 것이다.

이 글에서는 `ExecutorService`와 `FutureTask`를 사용하여 timeout 처리를 하는 간단한 예제를 소개한다.

* `ExecutorService`는 java 1.5 때 Doug Lea 아저씨가 추가한 좋은 Library이다. 이 글에서는 ThreadPool을 사용하기 위한 용도로 쓴다.
* `FutureTask` 역시 Doug Lea 아저씨가 추가한 class로 javadoc에서 그 설명을 간략히 따오면 cancellable asynchronous computation이다. 즉, 수행 Thread와 결과를 받는 Thread가 분리되고, 취소 가능하다. 이 class는 `RunnableFuture`를 구현하는데, 이는 `Runnable`와 `Future` 두 interface의 합성체이다.

어떤 작업에 timeout을 걸기 위해서는 적어도 수행 thread과 timeout을 걸어주는 thread가 분리되어야 한다. 간단하게 fork-join model을 생각해보자면 수행할 task는 fork된 thread에게 맡기고, join하는 main thread에서 join을 얼마나 기다려줄지 timeout을 지정해준다고 생각하면 되겠다.

java에서도 1.7부터 [fork/join pool](http://docs.oracle.com/javase/7/docs/api/java/util/concurrent/ForkJoinPool.html)을 지원해주지만, 본 글에서는 안 다룬다.

일단 무엇을 작업해서 반환할지에 대한 `FutureTask`를 구현한다. `FutureTask`는 이름 그대로 Future + Task이다. 즉 Task를 수행한 결과를 Future로 받아볼 수 있는 구조로, 생성자로 `Callable` 객체를 받고 수행을 위한 `run()` 함수와 결과 값을 받기 위한 `get()` 함수를 갖는다.

```java
FutureTask<String> task = new FutureTask<String>(
    new Callable<String>() {
        public String call() throws Exception {
            return /* complicated crawling code */;
        }
    });
```

뭔가 내부에서 복잡한 작업을 수행하는 callable object를 생성자로 받는 task 객체를 생성했다. 이제 task의 멤버 함수인 `run()`을 호출하게 되면 저 callable object가 실행되고, 그 수행 결과가 task 내부에 저장되는 것이다. 그러면 저 task의 상태가 completed(`isDone()`으로 확인) 인지 보고, `get()` 함수로 결과를 가져오면 되는 것이다.


이제 열심히 만든 task 객체를 수행할 thread를 생성하도록 하자. 하지만 thread를 매번 만드는 것은 매우 아깝고 귀찮은 일이므로 `ExecutorService`를 사용해보도록 하자.

```java
ExecutorServicce threadPool = Executors.newCachedThreadPool();
```

다 만들었다-_-; 이제 만든 ThreadPool을 사용하여 task를 실행해보자.

```java
threadPool.execute(task);
```

정말 간단하게 ThreadPool을 만들었고, 해당 ThreadPool 내에 cache된 thread에게 우리가 만든 task를 수행시켰다. 이제 main thread에서는 적절히 timeout을 걸고 기다려보자.

```java
try {
    String result = task.get(5 /* TIMEOUT */, TimeUnit.SECONDS);
    /* some codes for processing result */
} catch (TimeoutException e) {
    // timeout occurred!
}
```

결과값을 가져오는 `get()` 함수는 해당 task가 완료될 때까지 기다리는 함수이다(blocking). 이 함수는 timeout 시간을 인자로 받는 함수가 overload되어있는데, 위 예시처럼 해당 함수를 쓰면 해당 수행이 5초내로 끝나지 않으면 `TimeoutException`을 던지게 되는 것이다. 따라서 `TimeoutException`을 적절히 catch해서 적절하게 처리해주면 된다.