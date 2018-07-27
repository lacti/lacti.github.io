---
layout: post
title: class의 public과 private
tags: c++
---

예전에 동아리 선배님께서 어떤 코드를 수정하시면서 하셨던 말이 있다.

> "왜 멤버가 다 public 으로 되어있는거야!"

요즘 읽고 있는 코드에서 몇 개의 class 들이 저런 문제점을 지니고 있다.  
다음 예제를 보자.

```cpp
class Worker
{
public:
    void DoWork();
    void Run();
    void Append(Work*);
    void Remove(Work*);
    Work* GetWork(int);
public:
    volatile long workCount;
    Work* workArray;
};
```

*(volatile keyword를 사용한 이유는 다음에 설명하겠다)*

저런 class가 있다고 할 때 저 interface만 보고 class가 무슨 일을 하는지 알 수 있을까?

* 이름도 적절히 `Worker`이고,
* `DoWork`와 `Run`함수를 보니 `Work`를 실행해주는 것 같고,
* `Append`와 `Remove`가 있으니 뭔가 `Work`를 넣었다 뺐다도 할 수 있나보다.
* 그리고 `GetWork` 라는게 있으니까 뭔가 `Work` 객체를 가져올 수도 있나보다.
* 그리고 `WorkCount`, `WorkArray`가 있으니 내부에서 Work 객체를 저장하나보네?

**그런데 public?** 

그리고 로직 코드를 읽고 나서야 `DoWork`, `Remove`, `GetWork` 함수는 오로지 `Worker` 내부에서만 사용되고, 외부에서는 `Run`과 `Append` 함수만 사용한다는 것을 알게 되었다.  
그런데 심지어 `workCount`를 직접 접근하는 곳을 발견하였다 [...]

여기까지 읽은 사람이라면 수도 없이 많은 문제를 떠올리겠지만, 다 생략하고 몇 개만 보겠다.

* class의 역할을 파악하고 동작을 이해함에 있어 private의 역할은 꽤나 중요하다. public method는 외부에서 호출한다는 것이니까, 결국 이 class가 어떤 동작을 외부로 제공해 줄지를 결정하는 것이기 때문이다. 위의 class를 제대로 적어보면 아래와 같이 되어야하지 않을까. 개인적으로 private나 protected 구간도 여러 개로 설정해서 member, variable, static 을 또 나누어서 표현한다. 혹자는 아예 public method의 가장 아래 부분에 생성자, 소멸자를 적음으로써 이 밑으로는 볼 필요가 없다는 convention을 제시하기도 했다.

```cpp
class Worker
{
public:
    void Run();
    void Append(Work*);
    long GetWorkdCount();
private:
    void DoWork();
    void Remove(Work*);
    Work* GetWork(int);
private:
    volatile long workCount;
    Work* workArray;
};
```

* refactoring 등을 할 때 coverage 를 설정하기 위해서라도 private은 중요하다. 여기저기에서 호출하고 있는 method를 refactoring을 하는건 고난의 행군이 될 것이다. 최대한 외부로 노출되는 method 를 줄이고 private로 꽁꽁 묶어놔야 기능이나 설계를 개선할 때 수정으로 인해 영향을 받는 외부 부분이 줄어들면서 그나마 좀 나아지지 않을까 싶다.

이 이야기는 결국 귀에 못이 박히도록 들어온 encapsulation 이야기인데, 이런 저런걸 고려해볼 때 friend 의 등장은 저걸 저해하는 것 같으면서도 잘 구성할 수 있게 해준다.

private member variable이야 getter로 빼준다 할지라도, method의 경우는 접근할 방법이 없으니까.
~~(뭐 미친 척 하고 member function pointer 를 넘기면 되지 않을까 싶지만)~~

그런데 결국 friend를 해주면 coverage에 구멍이 생기니까 별로 좋은 일은 아니다.  
java의 package나 c#의 internal 같은 나름 우아한 방법으로 묶어주는 것도 좋을텐데 일단 C++은 그런게 없으니 namespace로 수작이라도 부려봐야지