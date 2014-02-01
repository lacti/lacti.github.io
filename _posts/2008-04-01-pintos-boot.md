---
layout: post
title: pintos 부팅 과정
tags: os -pub
---

우리가 일반적으로 사용하는 컴퓨터 내에 존재하는 시스템은 하드 디스크 등의 보조 기억 공간을 갖고 그 기억 공간에 접근하여 동작을 수행하는데, Pintos를 수행하는 bochs는 Pintos를 빌드하여 얻어진 이미지 파일을 하드 디스크 등과 같은 storage로 인식하여 emulating을 수행한다. 하지만 Pintos는 단순히 커널만 존재하기 때문에 우리가 일반적으로 사용하는 storage와 달리 이미지 파일에는 단순히 부팅을 위한 부트 섹터와 커널 이미지만 존재하게 된다.

### 부트로더 ###

부팅이란 컴퓨터가 구동하여 기초적인 초기화 작업을 수행하고 운영 체제를 읽어오는 일련의 작업을 말한다. 그리고 부트 섹터는 방금 언급한 기초적인 초기화 작업과 운영 체제를 읽어서 메모리에 올리고 수행시키는 작업에 대한 코드가 작성된 프로그램이 기록된 섹터로 장치의 첫 번째 트랙의 첫 번째 섹터를 지칭한다. 어떤 보조 기억 창치(storage)에 이러한 정보가 기술되어 있으면 BIOS는 컴퓨터가 구동된 후 연결된 storage들을 탐색하면서 해당 장치가 부팅 가능한 정보를 갖고 있는지 검사한다. 한 섹터의 크기는 512bytes이므로 정확히 말하자면 부트 섹터인 가장 첫 번째 섹터의 511번째 바이트와 512번째 바이트가 각각 `0x55` `0xAA`이어야 한다.

이러한 구조는 `loader.S`에 기술되어있다.

```asm
346 #### Boot-sector signature.
347 #### The BIOS checks that this is set properly.
348     .org LOADER_SIG - LOADER_BASE
349     .word 0xaa55
```

따라서 부팅을 수행하려면 일단 부팅을 수행하기 위한 일련의 작업들을 코드로 기술하고, 511byte와 512byte를 `0x55` `0xAA`로 끝내는 512bytes 짜리 기계어를 작성한 후에 가장 첫 번째 섹터에 기록하면 되는 것이다.

이런 방법을 사용하는 이유는 Pintos의 크기가 512bytes를 넘어가기 때문에 첫 번째 섹터에 그 기계어를 다 기록할 수 없기 때문이다. 따라서 부트 섹터에 기술된 기계어는 기초적인 초기화를 한 후 크기가 512bytes보다 큰 커널을 메모리에 올려놓고 그 지점으로 jump하여 운영 체제가 동작할 수 있게 해주는 것이다.

이제 BIOS를 emulate하는 bochs는 Pintos 이미지가 부팅 가능하다는 것을 알게 되었기 때문에 부팅을 수행한다. BIOS는 첫 번째 섹터를 읽어 메모리의 `0x7C00`에 올려놓고 작업을 시작한다. 지금부터 설명할 부팅 시 수행하는 작업들은 loader.S에 기술되어있다.

먼저 부팅이 시작되면 BIOS를 사용할 수 있는 16bit 모드로 작업을 수행한다. 추후에 다시 기술할 내용이지만 Pintos는 32bit 모드로 변환한 후에도 한참 뒤에나 장치의 interrupt를 handling하기 때문에 일단은 interrupt에 의해 부팅이 방해되는 것을 막기 위해 모든 interrupt를 막는다.

그리고 segment 레지스터를 초기화하고 loader의 코드가 올라간 메모리의 `0x7C00` 주소에 맞추어 origin을 설정한다. 그리고 기본적으로 설정되어있는 메모리 한계인 1MB를 풀기 위해 A20 회로를 활성화시킨다. 그 다음에 메모리의 크기를 얻는 작업을 수행한다. 여기서 BIOS를 사용한다.

BIOS는 Basic Input/Output System의 약자로 시스템의 기초적인 입출력을 담당하고, 또한 관련 함수를 제공해준다. BIOS에서 제공하는 함수를 호출하려면 interrupt를 사용해야 한다. 각 장치 별로 interrupt 번호가 존재하고 각 장치 내에서 수행할 함수는 보통 AH로 정한다. 유명한 BIOS interrupt로 디스크 관련 인터럽트인 INT 13과 화면 관련 인터럽트인 INT 10이 존재한다.

```asm
316 panic:  .code16         # We only panic in real mode.
317     movw $panic_message, %si
318     movb $0xe, %ah
319     subb %bh, %bh
320 1:  lodsb
321     test %al, %al
322 2:  jz 2b           # Spin.
323     int $0x10
324     jmp 1b
```

실제로 `INT 10`은 부팅 도중 PANIC이 일어났을 때 PANIC 문자열을 출력하기 위해 사용된다. 이 때 호출되는 함수는 `0x0E`번 함수인데 이는 `TELETYPE_OUTPUT` 함수이다.

### 메모리 초기화 ###

지금은 메모리의 크기를 얻기 위해서 인터럽트를 사용한다. 이 때 인터럽트 번호는 `0x15`번이고 함수 번호는 `0x88`번이다. 이 때 반환되는 값은 실제 물리 메모리의 크기에서 1024를 뺀 값으로 단위는 kB이다. loader에서는 여기에 1024를 더해서 실제 물리 메모리의 크기를 얻는다. 하지만 Pintos는 이미 64MB 메모리 용으로 4kB의 page를 갖는 page table를 작성해두었기 때문에 메모리의 64MB만을 사용하도록 설정한다.

그리고 Page Table Entries와 Page Directory Entries를 초기화 하여 기초적인 page table를 구성한다. 이는 기본적인 virtual memory를 위한 page table를 구성하고, 32bit로 전환한 뒤에 loader를 메모리의 커널 영역인 `0xC0007C00`으로 취급해서 수행하게 하기 위함이다. 32bit 모드에서는 메모리 주소를 가리킬 수 있는 레지스터의 크기도 32bit가 되므로 실제로 사상될 수 있는 메모리의 크기는 최대 2^32인 4GB이다. 보통 운영 체제는 이 중에서 0xC0000000 ~ 0xFFFFFFFF인 1GB를 커널 영역으로 사용한다.

```c
loader.h
 11 /* Kernel virtual address at which all physical memory is mapped.
 12
 13    The loader maps the 4 MB at the bottom of physical memory to
 14    this virtual base address.  Later, paging_init() adds the rest
 15    of physical memory to the mapping.
 16
 17    This must be aligned on a 4 MB boundary. */
 18 #define LOADER_PHYS_BASE 0xc0000000     /* 3 GB. */
```

위의 주석에서 언급되어 있듯이 물론 page의 초기화는 kernel에서 이루어져야 하지만 16bit에서 32bit로 전환되면서 보호 모드로 바뀌었기 때문에 일단은 기초적인 page 테이블이라도 구성해서 loader를 0x7C00으로 바로 접근하는게 아니라 `LOADER_PHYS_BASE`를 더한 `0xC000007C00`의 가상 주소로 접근한다는 것이다.

수행 bit 모드가 바뀌었으니 다시 segment를 초기화한다. 그리고 이제부터 이미지 내에 존재하는 KELNEL 코드를 메모리의 `LOADER_PHYS_BASE + LOADER_KERN_BASE (0x00100000)`에 적재한다.

`loader.S`의 코드를 보면 약 245줄부터 IDE Controller를 이용하여 `$KERNEL_LOAD_PAGES * 8 + 1` 개수만큼 읽는 것으로 추정되지만 `$KERNEL_LOAD_PAGE`의 값과 읽기 시작하는 섹터의 정보를 정확히 찾지 못했다. 아무튼 커널을 다 읽어서 메모리에 올려놓으면 커널 코드를 수행하기 위해 jump를 한다.

```asm
loader.S
296 #### Jump to kernel entry point.
297
298     movl $LOADER_PHYS_BASE + LOADER_KERN_BASE, %eax
299     call *%eax
300     jmp panic
```

만약 무슨 이유에서든지 커널이 메모리에 제대로 올라가지 않았거나하여 call 문이 실패하게 될 경우에는 바로 커널 패닉을 맛 볼 수 있도록 panic으로 jump를 한다.

### 진입점 이동 ###

jump로 `init.c`의 main로 바로 이동하는 것은 아니다. 이 main함수는 gcc에 의해 컴파일되면서 그 함수의 entry가 어디에 존재할지는 디어셈블리한 후에 여러 복잡한 계산을 해보기 전에는 모르기 때문에 일단 loader의 call에 의해 호출되는 지점의 코드는 어셈블리로 한 번 더 짜고(`start.S`) 그 내부에서 main을 호출하는 구조를 이루고 있다.

`loader.S`에서는 main을 호출할 수 없는데 `start.S`에서는 main을 그 symbol로 호출할 수 있는 이유는 빌드 과정에 있다. `loader.S`는 부트 섹터, 즉 첫 번째 기록되는 코드로써 혼자 따로 어셈블되어 0 ~ 511bytes의 위치에 기록되고, 나머지는 모두 커널 이미지라는 것으로 묶이는데 이 때 linker script인 `kernel.lds.S`에 의해 `init.c`의 `main()` 함수의 위치를 `start.S`가 알 수 있게 하여 `start.S`에서는 main으로 함수를 호출할 수 있게 되는 것이다.

```asm
start.S
  9 .globl start
 10 .func start
 11     # Call main.
 12 start:  call main
 13
 14     # main() should not return, but if it does, spin.
 15 1:  jmp 1b
 16 .endfunc
```

코드에서 볼 수 있듯이 12번 행에서 `call main`을 수행하고 있다. 그리고 어떤 이유에서든지 `main()` 함수가 종료된다면 15번 행의 무한 반복이 실행되어 절대 다른 지점으로 넘어갈 수 없도록 한다. 왜냐하면 `start.S` 뒤에 있는 것은 커널 이미지 빌드 과정에서 합쳐지는 어딘가의 소스 코드이거나 데이터 코드일 것이며, 만약 여기서 멈추지 않는다면 그 알 수 없는 코드들을 CPU는 모두 읽어서 처리하게 될 것이기 때문이다.

이제 `main()` 함수가 수행된다. `main()` 함수부터는 너무 깊게 들어가지 않고 가볍게 설명할 것이다.

### 커널 초기화 ###

c 코드로 구성된 `init.c`의 `main()` 함수가 실제 커널의 초기화와 수행을 맡는 코드이다. 일단 `ram_init()` 함수를 호출하여 BSS segment를 초기화 하고 page의 개수를 `ram_pages` 변수에 넣는다. page의 개수는 `loader.S`에서 페이지 테이블을 구성하기 위해 열심히 계산했었다.

그 다음에 `read_command_line()` 함수를 사용하여 kernel 실행 인자를 받는다. 일단 pintos 구동 시 입력 받는 인자를 부트 섹터의 `arg_cnt:`와 `args:`에 넣어둔 뒤에 kernel에서 이 위치에 있는 인자를 가져오는 방식이다.

```asm
loader.S
336 #### Command-line arguments and their count.
337 #### This is written by the `pintos' utility and read by the kernel.
338 #### The loader itself does not do anything with the command line.
339     .org LOADER_ARG_CNT - LOADER_BASE
340 arg_cnt:
341     .long 0
342     .org LOADER_ARGS - LOADER_BASE
343 args:
344     .fill 0x80, 1, 0
```

예를 들어 `pintos -v -- run alarm-multiple`을 수행할 경우 run과 alarm-multiple이 실행 인자가 되어 메모리의 저 영역에 올라가게 되고 `init.c`의 `main()`에서 이 값을 읽어서 처리하게 된다는 것이다.

그 다음에 `parse_options()` 함수에서 옵션을 분석한다. 이 커널은 몇 가지 옵션을 갖고 있는데 `-h` 옵션으로 해당 옵션에 대한 설명을 볼 수 있다(`init.c`의 334줄). 대표적인 옵션으로 `-q`를 주면 지정된 동작이 끝난 후 바로 커널의 수행을 종료(power off)한다.

```sh
$ pintos -v -- -q run alarm-multiple
```

그 다음에 `thread_init()` 함수를 호출하여 lock를 활성화시키고 대기 큐(ready_list)를 초기화한다. 그리고 현재 작동하고 있는 `ESP`를 기준으로 가장 근처에 있는 page를 찾아서 그 주소를 기준으로 thread 정보를 설정한다. 이 thread의 이름은 main으로 `initial_thread`가 된다. 그 후에 `console_init()`를 통해 console에 lock을 초기화한다. 이제부터 console를 사용할 수 있으므로 `printf` 함수를 사용할 수 있다.

`printf`로 메모리의 크기를 출력한 후에 `palloc_init()`, `malloc_init()`, `paging_init()` 함수를 차례로 수행하여 메모리를 초기화한다. `palloc_init`는 이름 그대로 page를 allocate하는 작업을 수행할 수 있도록 초기화하는 것이고, `malloc_init`는 `malloc`을 통한 메모리 할당을 수행하기 위해 초기화를 수행하는 것이다.

`paging_init()` 함수에서는 `loader.S`에서 구성했던 page table을 다시 구성하는 것이다. page table이란 메모리를 page로 관리하게 되면서 생긴 각 page에 대한 index를 갖고 있는 table인데 관리할 메모리가 커져감에 따라 page table도 같이 커져서 이 table을 관리할 또 다른 table이 필요했는데 그것이 page directory이다. 이 함수에서는 PD와 PE를 다시 구성한다.

그 다음에 다시 또 segment 설정을 수행한다. 먼저 `tss_init()`을 통해 task state segment를 설정하는데, 이는 커널이 task를 관리할 때 필요한 정보가 들어있는 segment이다. 그리고 `gdt_init()`를 통해 global description table을 초기화 한다. gdt 역시 task를 관리하는데 필요한 정보가 들어있는데 주로 메모리 보호나 segment 관련된 내용이다. `gdt_init()`에서는 kernel과 user의 code/data segment를 초기화하여 gdt를 구성한다. 여기서 segment privilege를 설정할 수 있다. 이는 해당 segement에 존재하는 기계어가 CPU의 중요한, 즉 다른 프로그램에 영향을 미칠 수 있는 코드를 수행할 수 있느냐에 대한 권한이다.

### 인터럽트 초기화 ###

그 다음에 interrupt를 초기화한다. `먼저 intr_init()` 함수를 호출해서 PIC(programmable interrupt controller)를 초기화한다. 이 PIC는 interrupt 장치에 연결되어 CPU에게 interrupt 신호를 보내주는 장치이다. 그리고 interrupt descriptor table인 idt를 초기화한다. 이 table에는 interrupt를 handling하는 handler 함수들이 연결되는데 지금은 일단 깨끗이 초기화한다. 그리고 덤으로 0번부터 19번까지의 interrupt 이름을 초기화하는데 이는 CPU가 운영 체제, 즉 커널에게 전달하는 interrupt이다.

PIC에 의해 전달되는 interrupt도 0번부터 시작하지만 `0x00`부터 `0x19`까지는 CPU가 커널에게 전달하기 위한 interrupt로 사용하고 그 이후부터가 PIC에 의한 interrupt가 된다. 대표적인 예로 조금 있다 보게 될 keyboard의 interrupt 번호는 `0x21`이다.  
interrupt table을 초기화했으므로 이제 각 interrupt에 대해 handler를 연결한다. 먼저 이번 과제의 예제로 주어진 thread에서도 사용되는 timer를 먼저 초기화한다. timer는 PIC `0x00`번으로 `timer_init()`에서 초기화를 한다. 함수 내부에서 보면 `intr_register_ext()` 함수를 이용하여 `0x20`에 `timer_interrupt()` 함수를 연결하는 것을 확인할 수 있다.

```c
timer.c
46   intr_register_ext (0x20, timer_interrupt, "8254 Timer");
```

그리고 동일한 방법으로 `kbd_init()`에서는 keyboard의 interrupt를 초기화한다. 아직은 사용하지 않지만 keyboard로부터 입력받은 interrupt는 interrupt queue에 넣어졌다가 interrupt를 처리하는 thread에 의해 처리되는데 이러한 동작을 수행하는 모듈이 input이다. 일단 `input_init()` 함수를 호출하여 초기화한다.

그리고 `exception_init()` 함수를 수행하여 아까 `intr_init()`에서 작성해두었던 `0x00` ~ `0x13`까지의 interrupt를 연결한다. 연결되는 handler를 살펴보면 `exception.c`의 72번째 줄에 존재하는 `kill` 함수인데 친절하게도 왜 죽는지에 대해 설명해주고 죽는다. 주석을 보면 user program에 의해 process가 잘못된 수행을 했을 경우에 이 handler이 호출된다고 한다.

그 다음에 `syscall_init()` 함수를 통해 system call interrupt를 handling한다. 현재 handling하는 system call은 `0x30`번 interrupt인데 단순히 “system call!”을 출력하고 끝나는 system call이다.

이상으로 software interrupt(exception), hardware interrupt, system call에 대한 interrupt handler 초기화 및 설정을 마쳤다.

이제 설정한 interrupt를 동작시켜야 한다. interrupt를 받지 않으려는 노력은 `loader.S`의 맨 처음에서부터 시작하여 중간에 메모리 크기를 측정하고 커널 이미지를 메모리에 올리면서도 행해져 왔다. 이제 interrupt를 받도록 설정하기 위해서 일단 threads를 시작한다.

`thread_start()` 함수는 가장 실행 우선 순위가 낮은 idle이라는 thread를 생성하여 동작시킨다. 그리고나서 `intr_enable()` 함수를 호출하여 interrupt를 활성화시키는데 그 이유는 idle에 있다. idle 함수는 일단 interrupt를 다시 disable시키고 thread를 block하여 다른 thread가 먼저 수행될 수 있도록 한다. 그 뒤에 다시 활동하게 되면 바로 inline assembly인 `sti; hlt`를 수행하게 되는데 이는 interrupt를 다시 enable하고 바로 정지하겠다는 것이다. hlt instruction은 CPU가 interrupt를 받을 때까지 대기시키는 instruction이다.

```c
thread.c
383       asm volatile ("sti; hlt" : : : "memory");
```

### 기타 ###

그 이후에 `serial_init_queue()` 함수를 통해 serial로부터 interrupt를 받아 커널을 제어할 수 있도록 한다. 이는 커널이 올라가 있는 장치에 keyboard로 바로 console를 통해 접속하는 것이 아니라 tty등의 serial interface로 접근했을 때도 커널이 반응할 수 있도록 하기 위함이다.

그 다음에 `timer_calibrate()` 함수에서 아까 설정한 timer interrupt에 의한 한 tick에 몇 번의 loop를 돌 수 있나 계산해서 전역 변수인 `loops_per_tick`에 넣어두고 이 값은 여러 `sleep()` 함수들의 동작을 실제로 수행하는 `real_time_sleep()` 함수에서 사용한다. 이 값을 사용하여 멈추기를 요구하는 시간을 근사한 loop 회수로 변환하여 `busy_wait()` 함수에서 지정된 회수만큼 반복문을 돌면서 대기한다.

그 밑의 `disk_init()`와 `filesys_init()`는 FILESYS가 있을 때 사용하는 함수로, 간단하게 설명하자면 `disk_init()` 함수에서는 커널에서 현재 연결된 storage를 검색해서 초기화하고, `filesys_init()`에서는 `disk_init()`에서 탐지하고 초기화한 disk를 가져와서 inode를 구성하거나 포맷을 수행한다.

마지막으로 `init.c`의 118번째 줄에서 `printf ("Boot complete.\n")` 를 수행함으로써 pintos의 부팅이 완료된다.

### 참고 ###

* [OS 구조와 원리: OS 개발 30일 프로젝트](http://www.hanbit.co.kr/book/look.html?isbn=978-89-7914-482-6)
* [Windows 구조와 원리: OS를 관통하는 프로그래밍의 원리](http://www.hanbit.co.kr/book/look.html?isbn=89-7914-396-6)
* [리눅스 커널 심층 분석](http://kangcom.com/sub/view.asp?sku=201207250002)
