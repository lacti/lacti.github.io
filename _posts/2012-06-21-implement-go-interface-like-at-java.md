---
layout: post
title: go interface 구현하기
tags: java -pub
---

사실 go interface가 어떤 스펙을 가졌는지는 모르겠고
그냥 [summerlight]님께서 그걸 c++로 구현하면 재미있겠다고 해서 시작을 한건데 대충 내용은 다음과 같다.

```cpp
class A {
public: void a(); void b(); void c();
};
class X {
public: void a() = 0;
};
class Y {
public: void b() = 0;
};
class Z {
public void c() = 0;
};

A obj;
X* x = /* 어떻게든 obj랑 연결 */;
x->a(); // A::a() 함수가 호출됨
```

A라는 class는 a, b, c라는 함수를 가지고 있지만, 명시적으로 X, Y, Z interface를 구현하고 있지 않기 때문에 X, Y, Z pointer로 A 객체를 지칭할 수 없다. 하지만 암시적으로라도, 동일한 함수 signature가 존재한다면 interface로 지칭할 수 있게 해주는 것이 목적이다. (template 함수에서 암시적 interface를 요구하는 것을 객체화하여 접근할 수 있게 하였다고 봐도 되겠다)

reflection을 사용하면 저걸 구현하는건 쉽다. 그렇지만 컴파일 시점에 대입 가능성을 보장해주려면 metaprogramming을 해야 한다.

이 때 함수 signature를 비교하여 대입가능성을 검사해야 하는데, 문제는 함수 signature에 함수 이름이 포함된다는 것이다. 이름은 string literal이 될 것이고, 이를 compile time에 비교하려면 적어도 constexpr을 쓰거나 char typelist(variadic template)를 써야하는데, constexpr와 variadic template 모두 vs2012에서 지원 안하니 ~~(그렇다고 gcc를 쓸 생각은 없으니)~~ 일단 무시한다.

결국 reflection을 써서 저 기능을 구현하면 되는데 c++로 reflection부터 만드려면 귀찮으니 java로 예제를 만들어 보자.

안타깝게도 (혹은 다행스럽게도) java에서는 연산자 overloading이 없으므로, interface 객체에 대상 객체를 대입하기 위한 static 함수를 하나 만들 것이다.

java reflection 중에는 `Proxy`라고 하여 해당 interface에 대한 method가 호출될 때, 그 method와 argument 정보를 하나의 함수로 모아주는(`InvocationHandler`) 좋은 class가 있다. (마치 ruby의 missing method나 php의 `__call`처럼)

덕분에 어떤 interface를 넣어도 `Proxy`를 적절히 써서, 해당 interface의 함수가 호출될 때 이 정보를 대상 객체(target)의 함수로 잘 넘겨서 실행해주면 되겠다.

이에 대한 코드는 다음과 같다.

```java
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

public class InfOp {
    public static <T> T assign(Class<T> infClazz, Object target) {
        return infClazz.cast(Proxy.newProxyInstance(infClazz.getClassLoader(), 
                new Class<?>[] { infClazz }, new InvocImpl(target)));
    }
    
    private static class InvocImpl implements InvocationHandler {
        private Object target;
        private Class<?> targetClazz;
        
        public InvocImpl(Object target) {
            super();
            this.target = target;
            this.targetClazz = target.getClass();
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args)
                throws Throwable {
            Method targetMethod = targetClazz.getMethod(method.getName(), 
                    method.getParameterTypes());
            return targetMethod.invoke(target, args);
        }
    }
}
```

핵심은 `InvocationHandler::Invoke()` 내에 있는 코드이다. interface class에서 호출되는 method의 정보(name, parameter = 결국 signature)를 사용하여 target 객체의 method 정보를 찾는다. 그리고 invoke를 하면서 argument도 넘겨주면 끝이다.


이제 다음과 같이 사용해볼 수 있다.

```java
public class Test {
    public static void main(String[] args) {
        Character ch = new Character();
        Drawable dr = InfOp.assign(Drawable.class, ch);
        dr.draw();
    }
}

interface Drawable {
    void draw();
}

interface Movable {
    void move();
}

class Character {
    public void draw() {
        System.out.println("draw!");
    }
    public void move() {
        System.out.println("move!");
    }
}
```

`Character` class와 `Drawable` interface는 명시적인 구현 관계(implements)가 없지만, 어쨌든 `draw()`라는 동일한 함수 signature를 갖는다. 따라서 `Character` 객체를 적절히 proxy로 감싸서 `Drawable` interface와 연결하여 위 코드처럼 실행시킬 수 있는 것이다.


*(조만간 compile time check를 포기한 c++ 버전도 올리도록 하겠다.)*