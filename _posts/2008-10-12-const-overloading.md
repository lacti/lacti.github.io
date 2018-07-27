---
layout: post
title: const overloading
tags: c++
---

c++의 overloading은 c에서 어떤 함수를 단순히 함수의 이름으로만 식별했던 것에 비해 함수의 인자의 type, 개수, 혹은 const/volatile 여부까지 고려해서 식별한다는 것이다.

즉 linking 시점에서 호출하는 지점과 호출 당하는 지점을 연결해줄 때 호출하는 지점에서 요구하는 함수의 정보(함수 이름, 인자 type, 개수, const/volatile 여부)를 기반으로 함수 table에서 찾아서 그 함수의 주소를 호출할 수 있도록 주소로 변환시켜 주면서 엮어준다는 것이다.

이 글에서는 const와 reference를 엮어, 그렇지 않은 함수와 함께 overloading을 하여 사용하는 것에 대한 글을 서술하도록 하겠다.

간단한 예를 들기 위해 1차원 array를 wrapping하는 class를 다음과 같이 작성한다고 해보자.

```cpp
#include <iostream>

class odarray { // one dimension
public:
    friend std::ostream& operator << (std::ostream& out, const odarray& array);

    int& operator [] (int index) { return mArray[index]; }
    int operator [] (int index) const { return mArray[index]; }
    int size (void) const { return mSize; }

    odarray (int size)
        : mSize (size) {
        mArray = new int[size];
        for (int i = 0; i < size; i++)
            mArray[i] = 0;
    }
    ~odarray (void) {
        delete[] mArray;
    }

private:
    int mSize;
    int* mArray;
};

std::ostream& operator << (std::ostream& out, const odarray& array) {
    for (int i = 0; i < array.mSize; i++)
    {
        out << array[i] << " ";
    }
    return out;
}

int main (int argc, char *argv[]) {
    odarray oa1 (10);
    oa1[4] = 10;
    std::cout << oa1 << std::endl;
    return 0;
}
```

`operator []`가 const인 것과 그렇지 않은 것 2개를 작성하였다. 둘의 함수 내용은 같지만 해당 함수가 호출되는 시점의 constness에 따라 다른 함수가 호출될 수 있다는 것이다.

* const가 붙어있는 함수는 int 값을 복사해서 반환하고,
* const가 붙어있지 않은 함수는 int& 자체를 반환하여 해당 값을 수정할 수 있게 해준다.

간단히 말해서 예를 들어보면,

```cpp
odarray oa1(10);
oa1[4] = 10;
std::cout << oa1 << std::endl;[/code]
```

`oa1[4] = 10;` 구문에서는 값의 변경이 필요하기 때문에 당연히 int&를 반환하는 non-constness 함수를 호출할 것이다.

하지만 `std::cout << oa1 << std::endl;` 구문에서는 `oa1`을 `ostream`으로 출력하는 함수의 원형을 봐야한다. `std::ostream& operator << (std::ostream& out, const odarray& array)`  
즉 이 함수는 인자로 `const odarray`를 받기 때문에 `odarray` 객체의 const를 보장하기 위해서 이 함수 내에서 호출되는 `odarray`의 멤버 함수는 모두 const 함수가 되는 것이다. 따라서 위 구문에서는 int를 반환하는 const 함수가 호출된다.

### 결론 ###

c++ compiler는 const를 보장해주기 위해서 const 객체의 멤버 함수를 호출할 때는 const 멤버 함수를 호출한다.

### 추가 ###

그래서 const overloading과 operator overloading을 결합하면 쉽게 getter/setter를 만들 수 있고, 이게 발전되어서 vb나 c#의 property가 된게 아닐까 싶다. 아 반환값 때문에 안되나-_-;

```cpp
object& operator [] (std::string propertyname);
object operator [] (std::string propertyname) const;
```
