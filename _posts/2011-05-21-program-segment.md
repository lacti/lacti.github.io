---
layout: post
title: 프로그램 세그먼트
tags: c memory -pub
---

(리눅스 커널의 이해 개정 3판 810쪽)  
유닉스 프로그램의 선형 주소 공간은 논리적인 관점으로 볼 때 몇 개의 선형 주소 구간으로 나뉘어있다

* **텍스트 세그먼트**는 실행 코드를 포함하고,
* **초기화된 데이터 세그먼트**는 초기화된 데이터, 즉 [정적 변수(static variable)](http://en.wikipedia.org/wiki/Static_variable)와 [전역 변수(global variable)](http://en.wikipedia.org/wiki/Global_variable)의 초기 값이 지정된 경우 그 값 자체가 실행 파일에 저장되어 포함되고,
* **초기화되지 않은 데이터 세그먼트**는 초기화되지 않은 데이터, 즉 초기값을 지정하지 않은 모든 전역 변수를 포함하고,
* **스택 세그먼트**는 반환주소, 매개변수, 실행하는 함수의 지역 변수 등을 담은 프로그램 스택을 포함한다.

이에 대해 linux에서는 memory descriptor (mm_struct 구조체)에서 관리를 하는데,  
이번에 면접을 볼 때, 지나가는 형식으로 해당 문제가 나왔다.

* 함수 내 static 변수와, 전역(global) 변수가 같은 메모리 공간에 할당되는가?  
	* 내 대답은 *그럴 것 같군요* 이었고,
	* 문제를 내신 분께서는 *사실은 그렇지 않다* 라고 답변을 주셨다.
	* *(물론 나중에 확인해보니 내가 문제를 잘못 이해한 것이었다)*

그래서 그냥 그러려니 하다가, 마침 잠도 깼고 할 일도 없어서 ULK를 보다가 이상함을 느끼고 직접 실험을 해봤다.

```c
#include <stdio.h>

#define PRINT_ADDR_AND_VALUE(var_name) \
  printf ("%40s (%16p -> %d)\n", #var_name, &var_name, var_name)

int _global_not_initialized;
int _global = 100;

static int _global_static_not_initialized;
static int _global_static = 100;

void function (void)
{
  static int _static_in_function_not_initialized;
  static int _static_in_function = 100;
  int _local_in_function_not_initialized;
  int _local_in_function = 100;

  PRINT_ADDR_AND_VALUE (_static_in_function_not_initialized);
  PRINT_ADDR_AND_VALUE (_static_in_function);
  PRINT_ADDR_AND_VALUE (_local_in_function_not_initialized);
  PRINT_ADDR_AND_VALUE (_local_in_function);
}

int main (int argc, char *argv[])
{
  static int _static_in_main_not_initialized;
  static int _static_in_main = 100;
  int _local_in_main_not_initialized;
  int _local_in_main = 100;

  PRINT_ADDR_AND_VALUE (_global_static_not_initialized);
  PRINT_ADDR_AND_VALUE (_global_static);
  PRINT_ADDR_AND_VALUE (_global_not_initialized);
  PRINT_ADDR_AND_VALUE (_global);

  PRINT_ADDR_AND_VALUE (_static_in_main_not_initialized);
  PRINT_ADDR_AND_VALUE (_static_in_main);
  PRINT_ADDR_AND_VALUE (_local_in_main_not_initialized);
  PRINT_ADDR_AND_VALUE (_local_in_main);

  function ();
  return 0;
}
```

실험 방법은 위의 코드를 사용하여 전역적(global), 정적(static), 그리고 초기화된(initialized), 초기화되지 않은(not initialized) 마지막으로 함수 stack 변수까지 메모리 주소와 그 값을 비교해보도록 하였다.

실행 결과는 다음과 같고,

```c
          _global_static_not_initialized (        0x601040 -> 0)
                          _global_static (        0x601024 -> 100)
                 _global_not_initialized (        0x60104c -> 0)
                                 _global (        0x601020 -> 100)
         _static_in_main_not_initialized (        0x601044 -> 0)
                         _static_in_main (        0x601028 -> 100)
          _local_in_main_not_initialized (  0x7fffde739c6c -> 0)
                          _local_in_main (  0x7fffde739c68 -> 100)
     _static_in_function_not_initialized (        0x601048 -> 0)
                     _static_in_function (        0x60102c -> 100)
      _local_in_function_not_initialized (  0x7fffde739c3c -> 32705)
                      _local_in_function (  0x7fffde739c38 -> 100)
```

위 문제와 연결지어 정리하면 이와 같다. 위 쪽이 memory의 high address이고 아래 쪽이 low address이다. 세 개의 영역으로 구분지었는데, 위에서부터 [스택(Stack)](http://en.wikipedia.org/wiki/Data_segment#Stack), [초기화되지 않은 영역(BSS)](http://en.wikipedia.org/wiki/Data_segment#BSS), [초기화된 영역(Data)](http://en.wikipedia.org/wiki/Data_segment#Data)이다.

```c
          _local_in_main_not_initialized (  0x7fffde739c6c -> 0)
                          _local_in_main (  0x7fffde739c68 -> 100)
      _local_in_function_not_initialized (  0x7fffde739c3c -> 32705)
                      _local_in_function (  0x7fffde739c38 -> 100)

                 _global_not_initialized (        0x60104c -> 0)
     _static_in_function_not_initialized (        0x601048 -> 0)
         _static_in_main_not_initialized (        0x601044 -> 0)
          _global_static_not_initialized (        0x601040 -> 0)

                     _static_in_function (        0x60102c -> 100)
                         _static_in_main (        0x601028 -> 100)
                          _global_static (        0x601024 -> 100)
                                 _global (        0x601020 -> 100)
```

이 결과로 볼 때 세 가지 영역으로 구분할 수 있다.

* 첫 번째는 **스택 공간**으로 지역 변수, 함수 인자, 반환 주소 등이 들어가는 공간이다. 본 실험과 크게 상관없는 부분으로 [call stack](http://en.wikipedia.org/wiki/Call_Stack)에 따라 아래(low address)로 증가하는 것을 확인할 수 있다.
* 두 번째는 **초기화되지 않은 데이터 세그먼트**, 즉 저 유명한 [BSS(Block Started by Symbol)](http://en.wikipedia.org/wiki/.bss) 영역이다. 메모리 주소의 순서를 보면 global 영역에서 선언된 변수와 static하게 함수 내에서 선언된 변수가 사이좋게 같은 영역 내에 할당된 것을 확인할 수 있다.
  * 단, 재밌는 것은 static하게 선언된 global 변수보다 그냥 global 변수가 더 메모리 상위 주소 공간에 할당된다는 것이다. 이는 단일 파일 내에서 접근되는 메모리 변수 영역과 [다른 모든 파일 내에서 접근되는 메모리 변수 영역](http://en.wikipedia.org/wiki/External_variable)을 분리함으로써 효율성을 도모한 시도로 추측된다. <span style="color: #ccc;">(본 내용에 관해서는 추후 확인할 예정이다)</span>
* 세 번째는 **초기화된 데이터 세그먼트**이다. 함수 내 static 변수나 프로그램 global 변수나 static한 global 변수나 사이좋게 선형적 주소 공간을 가짐을 확인할 수 있다. 재미있는 것은 초기화된 데이터가 메모리에 쌓이는 순서는 순전히 코드 내의 순서에 의존한다는 것이다.<span style="color: #ccc;">(본 내용에 관해서도 추후 확인할 예정이다)</span>

파생되는 이야기가 많아졌는데, 결론을 내리자면  
static 변수나 global 변수가 **같은 공간**에 할당된다는 것이다. 물론 **초기화된 변수와 초기화되지 않은 변수**는 다른 공간에 분리되어 선언된다.

[http://en.wikipedia.org/wiki/Data_segment#Data](http://en.wikipedia.org/wiki/Data_segment#Data)

> static int i = 10; will be stored in data segment and global int i = 10; will be stored in data segment

물론 메모리 할당 순서가 컴파일러 의존적일 것이라고는 생각되고, 본 실험이 철저히 gcc 기반으로 수행되었기 때문에 다른 컴파일러에서도 그럴 것이다라고 단정 지을 수는 없을 것이다.