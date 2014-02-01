---
layout: post
title: lambda와 RAII 1
tags: c++ -pub
---

C++11 에서 도입된 lambda expression을 통한 RAII 구현 방식의 한 예와, 단위 전략을 통한 RAII 구현을 통해 장단점을 비교해보자.

[Wiki: Resource Acquisition Is Initialization(RAII)](http://en.wikipedia.org/wiki/Resource_Acquisition_Is_Initialization)는 scope 내의 정적으로 할당되는 객체의 생존 주기로 생성자와 소멸자가 쌍으로 호출되는 것을 사용하는 자원 관리 기법이다. 보통

* IO (열었으면 닫아야하니까),
* 메모리 (할당했으면 해제해야하니까, shared_ptr도 AddReference 했으면 ReleaseReference)
* Lock (Lock 걸었으면 Unlock 해줘야하니까)

등에서 사용된다.

본 글에서는 Lock을 사용하여 예를 들어보자.

```cpp
class lock_t {
public:
    void lock();
    void unlock();
};
```

위와 같은 `lock_t` class가 정의되어 있다. 어떤 class에서 저 객체를 쓴다고 해보자.

```cpp
class item_t;
typedef __int64 item_id_t;
typedef std::shared_ptr<item_t> item_ref;

class inventory_t {
public:
    item_ref find(item_id_t item_id);
private:
    lock_t lock;
    std::vector<item_ref> items;
};

item_ref inventory_t::find(item_id_t item_id) {
    lock.lock();
    auto iter = std::find(items.begin(), items.end(), find_item_by_id(item_id));
    if (iter != items.end())
        return (*iter);
    lock.unlock();
    return item_ref(NULL);
}
```

inventory가 가지고 있는 item에 대한 정보는 item의 `vector`로 관리하고 있다. 저 inventory 객체를 여러 Thread에서 접근한다고 하면, `std::find()`에 의해 `vector`를 순회하다가 접근 위반이 발생할 가능성이 있다. (한 thread 는 순회하고, 한 thread 는 vector 에 삽입/삭제할 경우)
따라서 lock을 사용하여 해당 container 를 보호해준다.

하지만 위 코드는 문제가 있다.  
`lock`을 사용하여 `items`로의 접근을 보호하지만, 실제 item을 찾은 다음 return 문을 수행하기 전에 `unlock`을 수행하지 않았기 때문이다. 이러한 문제는 `find` 함수가 좀만 길어지면, 혹은 조금만 신경을 쓰지 않게 되면 흔히 발생할 수 있는 문제이다.

따라서 이러한 문제를 해결하기 위해 정적 객체의 생존 주기를 활용한다.

```cpp
class scope_lock_t {
public:
    scope_lock_t(lock_t* _lock) : lock(_lock) { lock->lock(); }
    ~scope_lock_t() { lock->unlock(); }
private:
    lock_t* lock;
};
```

멤버로 `lock_t`에 대한 pointer를 갖고, 생성자에서 `lock()`을 부르고 소멸자에서 `unlock()`을 부르도록 하는 `scope_lock_t` class를 설계한다. 그러면 코드가 아래와 같이 바뀐다.

```cpp
item_ref inventory_t::find(item_id_t item_id) {
    scope_lock_t scope_lock(&lock);
    auto iter = std::find(items.begin(), items.end(), find_item_by_id(item_id));
    if (iter != items.end())
        return (*iter);
    return item_ref(NULL);
}
```

`scope_lock_t` 객체가 멤버 변수인 `lock`을 가지고 생성된다. 생성될 때 `scope_lock_t`의 생성자에서 `lock()` 함수가 불린다. 그리고 실제 로직이 아래에서 수행되고 `inventory_t::find()` 함수가 종료되는 시점, 즉 `scope_lock_t` 객체가 소멸되는 시점에 `unlock()` 함수가 불린다.

생성자와 소멸자는 해당 객체의 생성/소멸 시점에 컴파일러가 알아서 불러주므로, 위와 같이 `scope_lock_t`를 만들어 쓰면 중간에 return을 해도, goto를 해도, 1년 뒤에 코드를 고쳐도! lock-unlock쌍이 잘 맞게 된다. 
[(객체 생성/소멸자와 goto 에 대한 이야기)]({% post_url 2011-07-20-object-ctor-dtor-with-goto %})
