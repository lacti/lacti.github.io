---
layout: post
title: 멤버 데이터 포인터의 casting과 안정성 1
tags: c++ -pub
---

어제 동아리 친구와 이야기를 나누다 run-time에서는 float array를 float pointer로 casting하여 사용할 수 있는데 compile time에서는 왜 그럴 수 없냐는 이야기가 나왔다.

질문이 좀 미묘한데, 좀 더 정확히 정의하자면 *float array type의 member data pointer를 float pointer type의 member data pointer로 casting하여 사용할 수 없냐*는 이야기이다.

**일단 결론부터 이야기하자면, casting은 가능하지만 정의되지 않은 동작을 한다.**

예제 코드를 간단히 꾸려보면 다음과 같다.

```cpp
enum stat_speed { ss_walk, ss_run, ss_max };

struct stat_t {
    stat_t() {
        std::fill(speed, speed + ss_max, 0.0f);
    }

    float speed[ss_max];
};

template <float* stat_t::*dataptr>
struct accessor {
    static float get(stat_t& obj) {
        return *(obj.*dataptr);
    }
};

int _tmain(int argc, _TCHAR* argv[])
{
    typedef float* stat_t::*fpointer_ptr;
    // fpointer_ptr aptr = static_cast<fpointer_ptr>(&stat_t::speed); // cannot convert
    fpointer_ptr aptr = reinterpret_cast<fpointer_ptr>(&stat_t::speed);
    
    stat_t stat;
    typedef accessor<reinterpret_cast<float* stat_t::*>(&stat_t::speed)> accessor;
    std::cout << accessor::get(stat) << std::endl;
    return 0;
}
```

`stat_t`의 `speed`는 `float (stat_t::*)[ss_max]` type이다. 이것을 `float* stat_t::*` type으로 바꿔볼 것이다. 당연한 이야기이지만 이 두 개의 type은 완전히 다르기 때문에 `static_cast`로는 형 변환이 안된다. 때문에 `reinterpret_cast`를 사용해서 강제 형 변환을 유도해야 한다.

(run-time에서 메모리에 존재하는 배열과 그곳을 접근하기 위한 주소 값의 의미인 포인터로 둘이 동일하게 동작하는 것으로 생각할 수는 있지만, compiler가 생각하는 type 입장에서는 완전 다른 type이다.)

template parameter로 넘겨줄 때에도 `reinterpret_cast`를 사용해서 넘겨주면 형식 안정성을 다 무시하고 그냥 넘겨줄 수 있다. 때문에 위 `accessor::get()` 함수가 호출되는 위 코드 전체에는 아무런 compile error가 없다.

template programming을 하는 이유가 compile time에 검사해주는 type check를 사용하여 형식 안정성을 보장해주기 위함인데, `reinterpret_cast`가 들어간 시점에서 위 코드는 그냥 망했다.

뭐 일단 casting해서 template parameter를 넘길 수 있냐 없냐를 보여주기 위한 억지 예제이기는 하다. 이제 compile 성공 여부를 떠나서 위 코드가 제대로 실행되는지 보자.

일단 member data pointer가 어떤 구조를 가졌는지를 설명해야 하는데, 자세한 내용은 대충 이 pdf의 chapter 3에서 확인하고 요점만 이야기해보자.

* [PDF: Inside the C++ object model](http://www.dsi.fceia.unr.edu.ar/downloads/informatica/info_II/c++../inside.the.c++.object.model.pdf)

member function pointer를 보면, 단순히 어떤 클래스의 함수의 주소 값만 가지고 있으면 될 것 같지만 이게 vfptr를 참조해야 하는지, 그리고 그 상속 구조가 다중 상속 혹은 virtual 상속 구조인지에 따라서 내부 구성이 좀 달라진다. 그런데 이게 c++ 표준에 명세만 있고 구현이 없어서 컴파일러마다 구현체가 제각각이다. (즉 무슨 짓을 해놓는지 모름)

* [Wiki: Thunk (object-oriented programming)](http://en.wikipedia.org/wiki/Thunk#Object-oriented_programming)

위와 동일한 개념이 member data pointer에도 적용된다고 보면 된다. 때문에 member data pointer가 단순 offset_of의 개념이라고 생각하면 안된다. (사실 고백하자면, 이 예제를 이해하는데 위 내용을 다 알아야 할 필요는 없지만 그냥 기회가 되었으니 공부하는 셈 치고 보면 좋다)

즉, 위 예제에서 `float (stat_t::*)[ss_max]`를 `float* stat_t::*`으로 casting하고, 그것을 dereferencing한 `float*` 값을 다시 dereferencing했을 때 `speed[ss_walk]`가 나오지 않는다는 이야기다. (즉 run-time에서 우리가 해왔던 것과는 조금 다르게 동작한다)

심지어 예제를 돌려보면 잘못된 메모리 접근으로 프로그램이 계속 죽는다!

시간이 부족한 관계로 위 예제가 실제로 어떻게 동작하는지 disassemble해서 살펴 보는 것과 그러면 어떻게 이해를 해야 하고 어떻게 코드를 고치면 위 문제를 풀어볼 수 있을지에 대해서는 다음 글에서 알아보자.