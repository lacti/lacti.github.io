---
layout: post
title: Concurrent Pool (Static Size)
tags: concurrency c++ -pub
---

정적인 크기의 Thread-safe한 (Concurrent) Object Pool을 만들어보자.  
핵심은 배열을 사용한다는 것. 왜냐하면 여러 thread가 접근해도 자신만의 index 지점을 접근하면 한 지점에 동시에 thread가 접근하면서 발생하는 문제가 없기 때문.

이게 동적으로 크기가 확장되면 배열의 포인터가 무효화되면서 여러 문제가 생길 수 있어 복잡하다. 따라서 정적인 크기라고 고정짓고 이야기를 해보자.


Object Pool은 미리 Object들을 만들어놓고 필요할 때마다 하나씩 꺼내서 쓰겠다는 것이다. 그 이유는 객체 생성과 소멸, 메모리 할당과 해제의 비용이 아깝기 때문.  
(때에 따라서 객체의 초기화 비용은 중복될 수도 있다. 다시 사용하기 전에 초기화할 수도 있으니까)

따라서 미리 객체를 일정 개수만큼 만들어놓고, 필요할 때 꺼내서 쓰고, 다시 집어넣어서 **재사용** 가능하게 해주는 기법이 Object Pool 이라고 보면 된다.

### 구현과 한계 ###

일정 크기만큼의 객체 배열을 생성한다. 이 때 여러 Thread가 객체를 하나씩 요구할 때, 공유되는 변수는 index 하나 뿐이다.  
즉, 여러 Thread가 객체를 동시에 요청해도, index 값만 원자적으로 증가시켜서 그 index에 위치한 객체만 해당 thread에게 반환한다. 그렇게 되면 index의 객체는 오로지 그 thread에서만 접근이 가능하므로 thread-safe하게 접근할 수 있을 것이다.

말로 설명하니 길고 지루한데, 요약하자면

* circular queue에서 index를 interlocked으로 증가시켜서 그 지점에 객체를 넣었다 뺐다 할 수 있게 해주면 thread-safe한 object pool이 만들어진다는 것이다.

```cpp
template <typename T>
class ObjectPool {
public:
    bool Pop (T& element);
    bool Push (const T& element);

    LONG Count (void) const { return mCount; }
    LONG Size (void) const { return mSize; }

    ObjectPool (LONG size);
    ~ObjectPool (void);

private:
    T*   mArray;
    LONG mSize;
    LONG mCount;

    LONG mPushIndex;
    LONG mPopIndex;
}
```

생성과 소멸은 객체의 배열의 할당과 해제를 해주면 된다.

```cpp
template <typename T>
ObjectPool<T>::ObjectPool (LONG size)
    : mSize (size), mCount (0), mPushIndex (0), mPopIndex (0) {
    mArray = new T[size];
}
template <typename T>
ObjectPool<T>::~ObjectPool (void) {
    delete[] mArray;
}
```

`Push`와 `Pop`은 Circular Queue와 동일하다. 다만 index를 증가시키는 부분이 interlocked으로 작성되어있다는 것이다.

```cpp
template <typename T>
bool ObjectPool<T>::Pop (T& element) {
    int index = InterlockedIncrement (&mPopIndex) % mSize;
    if (is_null (mArray[index]))
        return false;
    element = mArray[index];
    set_null (mArray[index]);
    return true;
}
template <typename T>
bool ObjectPool<T>::Push (const T& element) {
    int index = InterlockedIncrement (&mPushIndex) % mSize;
    if (!is_null (mArray[index]))
        return false;
    mArray[index] = element;
    return false;
}
```

`Push`와 `Pop`함수가 `bool`을 반환하는 이유는 Pool의 크기가 정적인 이상 해당 요청이 실패할 수도 있기 때문이다.  
`T`라는 type 자체가 포인터일 경우에는 `Pop` 함수에서 `NULL`을 반환하게 한다거나, 아니면 예외를 던지게 하는 방법이 있을 수 있겠지만 별로 둘 다 좋은 방법 같지는 않다는 생각에 `bool`을 반환하게 했다.

또 하나의 문제는 `is_null`과 `set_null` 함수이다. 이 뜬금없는 함수에 대한 구현은 여기서 설명할 수 없는데, 그것은 이 기능이 각 type 마다 다르기 때문이다.  
만약 `T`가 포인터 type이라면 위 문제는 간단해진다. `is_null` 함수는 그 지점이 `NULL`인지만 비교하면 되고, `set_null` 함수는 그 지점에 `NULL`을 넣어주면 되니까.

하지만 그냥 객체이면 문제가 좀 복잡해지는데, 저걸 설정해줄 수 있도록 `T` 자체가 기능을 포함하는 건 어불성설이고, 아마도 `T`에 대한 proxy 객체를 쓰든지 해서 해당 지점이 유효한지, 유효하지 않은지를 관리하도록 하는게 좋을 것 같다.

아니면 bool array를 크기만큼 하나 더 만들어서 그 지점에 데이터가 이미 있는지 없는지를 검사하게 하는 것도 방법일 수도 있겠다.

위와 같은 2가지 방법은 완벽한 해결책이 될 수 없다. 왜냐하면 Thread 1이 `Push`를 해서 해당 지점에 객체를 반환하고, bool 값을 update하기 직전에, Thread 2가 `Pop`을 요청했는데 그 지점이라면 값을 가져갈 수가 없기 때문이다. (아직 bool 값이 갱신되지 않았으니까.)  
그런데 이 문제는 T가 포인터일 때 NULL을 대입하고 검사하는 과정에서도 `Push`와 `Pop`이 빈번하다면 발생할 수 있을 것 같다.

이를 해결하려면 더욱 첨예한 알고리즘을 사용해야하는데 이에 대해서는 고민을 좀 더 해봐야겠다.

### 결론 ###

Circular Queue를 이용하여 Concurrent Object Pool을 간단하게 구성해보았다. 하지만 유효성 검사 한계 때문에 일반 객체에 대해서는 사용하지 못하고 포인터에 대해서만 사용 가능할 것 같다.

그나마도 Push와 Pop을 빈번하게 할 경우 문제가 발생할 수 있으니 좀 더 고민해서 좋은 구조를 만들어보자.