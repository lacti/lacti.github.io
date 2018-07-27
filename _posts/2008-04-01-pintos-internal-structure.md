---
layout: post
title: pintos 기본 구조와 동작 원리
tags: os
---

### Pintos의 기본 구조 ###

Pintos는 가장 기본 기능인 threads를 중심으로 user program, virtual memory, 그리고 file system을 추가하는 구조를 갖는다. 그래서 소스 코드의 분포 역시 기본적인 것들은 threads 디렉토리에 다 있고, 그 밖의 것들은 각각의 디렉토리에 존재하면서 threads에 있는 소스 코드를 참조하는 식으로 되어있다. 그리고 Pintos를 구성하는 데는 필요하지만 과제 항목에는 포함되어있지 않은 기본 library나 device는 별도의 디렉토리에 존재한다.

즉, 기본적인 구조와 틀은 이미 threads의 init.c에 모두 존재하고 과제를 수행하면서 기능을 더 추가하거나 수정하는 구조로 되어있어 커널의 기본 틀을 고칠 일은 없는 구조로 구성되어있다.

예외라면 virtual memory가 예외인데, vm 디렉토리에 아무 파일이 없는 것으로 알 수 있듯이 virtual memory는 완전히 새로 추가되는 기능이라고 볼 수 있다. 사실 정확히 말하자면 page의 기능을 개선하는 것이지만 다른 과제에 비한다면 그 틀이 없다고 볼 수 있다.

```bash
vm/build/Makefile
57 # No virtual memory code yet.
58 #vm_SRC = vm/file.c         # Some file.
```

그러면 결국 pintos의 기본 구조를 설명하려면 뼈대인 init.c의 main 함수를 설명해야할 것인데, 이미 부팅하는 과정에서 main 내의 대부분의 내용을 설명해버렸으므로 이 부분에서는 그 이후부터 설명할 것이다.

“Boot complete.”를 출력한 이후에는 코드가 몇 줄 남아있지 않다.

```c
init.c
120   /* Run actions specified on kernel command line. */
121   run_actions (argv);
122
123   /* Finish up. */
124   if (power_off_when_done)
125     power_off ();
126   thread_exit ();
```

단순히 run_actions 함수에게 부트 로더로부터 읽어온 실행 인자를 보내고, 그 일이 끝나면 사용자의 요구에 따라서 전원을 끄거나 아니면 그대로 멈추거나 한다.

먼저 run_actions 함수 내부를 보면 내부에 실행 인자로 들어오는 명령 이름과 mapping되는 함수들이 action이라는 구조체로 table을 형성하고 있다. 실제로 이번 tour에서 수행하는 run alarm-multiple의 run도 여기에서 run_task란 함수와 mapping되어 그 함수가 수행되어 alarm-multiple가 동작하게 됨을 알 수 있다.

```c
init.c
286   /* Table of supported actions. */
287   static const struct action actions[] =
288     {
289       {"run", 2, run_task},
290 #ifdef FILESYS
291       {"ls", 1, fsutil_ls},
292       {"cat", 2, fsutil_cat},
293       {"rm", 2, fsutil_rm},
294       {"put", 2, fsutil_put},
295       {"get", 2, fsutil_get},
296 #endif
297       {NULL, 0, NULL},
298     };
```

연결된 함수 포인터를 통해 다음과 같이 mapping된 함수를 수행함을 볼 수 있다.

```c
init.c
317       /* Invoke action and advance. */
318       a->function (argv);
319       argv += a->argc;
```

기본 구조이므로 가볍게 `run_task`만 따라가서 분석을 해보면, 내부에서 `process_execute`라는 함수를 통해 실행 인자 중 첫 번째 인자로 들어오는 task의 이름을 인자로 보내어 해당 task에 대한 process를 생성한다, 실제로 이 동작은 `USERPROG` 매크로가 true일 때 수행되는 명령으로 여러 프로그램이 동시에 수행되어야할 때 그들을 프로세스로 관리하기 위해서 사용되는 부분이다. threads에서는 `USERPROG`가 false이므로 수행되지 않는다.

따라서 바로 `run_test` 함수로 수행할 동작의 이름인 `alarm-multiple`을 인자로 호출한다. 여기서는 tests라는 배열에 또 threads의 test함수와 이름이 mapping 되어있다.

```c
threads/test.c
12 static const struct test tests[] =
13   {
14     {"alarm-single", test_alarm_single},
15     {"alarm-multiple", test_alarm_multiple},
16     {"alarm-simultaneous", test_alarm_simultaneous},
```

`run_test` 함수에서는 인자로 받은 이름과 일치하는 함수를 찾아서 호출해준다. 즉, 여기서는 `test_alarm_multiple`이 호출된다.

```c
threads/test.c
52     if (!strcmp (name, t->name))
53       {
54         test_name = name;
55         msg ("begin");
56         t->function ();
57         msg ("end");
58         return;
59       }
```

`test_alarm_multiple` 함수는 `test_sleep`라는 내부 테스트 함수를 다시 호출한다. `test_sleep (5, 7)`으로 호출하는데 첫 번째 인자인 5가 생성할 thread의 개수이고 7이 반복을 수행할 개수이다. `alarm-multiple`를 수행했을 때 결과를 보면 thread가 0번부터 4번까지 5개가 나오고 각각 7번씩 화면에 출력되는 것을 볼 수가 있다. 차이가 있다면 0번 thread는 딜레이가 10, 1번 thread는 딜레이가 20으로 증가하여 4번 thread는 딜레이가 50이 되는 구조이다. 그래서 출력 결과물에 보면 해당 iteration을 수행할 때까지 걸린 누적 시간을 출력하는데, 0번 thread는 7을 70에 출력하고 끝나고 4번 thread는 7을 350에 출력하는 것을 볼 수 있다.

`test_sleep`에서는 위에서 말한 동작을 수행하는 코드가 작성되어있다. thread를 지정된 개수만큼 생성하고 지정된 시간만큼 쉬고 쉰 다음에 출력에 대한 lock을 얻어 그 값을 증가시키는 구조이다.

정리하자면, Pintos의 커널은 기본적으로 init.c의 main 함수에 모두 들어가있다. 부팅 과정에서 커널을 메모리에 불러오는 부분은 예외이지만 커널을 초기화하고 사용자로부터 입력을 받아 그 입력을 처리하는 부분까지 모두 main 함수에 구현되어있는 구조이다.

### Pintos의 동작 방식 ###

Pintos의 내부 동작에 대해서는 위에서 모두 설명했기 때문에 여기서는 Pintos의 커널에게 실행 인자를 넘기고 그것을 어떻게 Pintos가 받아들인 뒤 해석하여 수행하는지에 대해 기술하겠다.

먼저 Pintos의 실행 부분부터 보겠다. 보고서에 기술된 Pintos의 실행 명령은 다음과 같다.

```bash
$ pintos -v -- run alarm-multiple
```

이 실행 명령은 --를 기준으로 앞과 뒤로 나뉠 수 있다. --의 앞 쪽에 존재하는 옵션은 pintos를 통해 bochs에 전달되는 옵션이다. 따라서 no-gui 모드로 구동하라던지 아니면 메모리의 크기를 설정하겠다던지의 옵션을 지정할 수 있다.

그리고 -- 이후에 나오는 옵션이 바로 Pintos의 커널에게 전달될 인자들이다. 사실 pintos 파일은 perl로 구성된 스크립트로 --을 기준으로 앞 뒤를 잘라 앞의 것은 bochs로, 뒤의 것은 커널로 전달하는 역할을 수행한다. 따라서 --을 입력한 뒤에 한 칸을 띄고 run 등의 인자를 입력해야 정상 동작이 된다.

여기서 추출된 인자는 pintos 내부의 prepare_argument로 전달되고 이 함수는 다시 write_cmd_line 함수를 호출하여 인자로 받은 내용을 커널 이미지 파일의 인자를 넣는 부분에 직접 기록한다.

```bash
pintos/src/utils/pintos
356 # Writes @args into the Pintos bootloader at the beginning of $disk.
357 sub write_cmd_line {
358     my ($disk, @args) = @_;
359
360     # Figure out command line to write.
361     my ($arg_cnt) = pack ("V", scalar (@args));
362     my ($args) = join ('', map ("$_\0", @args));
363     die "command line exceeds 128 bytes" if length ($args) > 128;
364     $args .= "\0" x (128 - length ($args));
365
366     # Write command line.
367     my ($handle, $file_name) = open_disk_copy ($disk);
368     print "Writing command line to $file_name...\n";
369     sysseek ($handle, 0x17a, 0) == 0x17a or die "$file_name: seek: $!\n";
370     syswrite ($handle, "$arg_cnt$args") or die "$file_name: write: $!\n";
371 }
```

커널에서 인자를 받는 부분은 loader.S에서 다음과 같이 정의되어있다.

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

부트 섹터는 첫 번째 섹터로 그 크기가 512bytes이다. 이를 16진수로 나타내면 0x200인데 loader.h에서 정의하는 상수들을 사용하여 잘 계산해보면 `arg_cnt`와 `args`의 byte 위치를 계산할 수 있다. 당연한 이야기이지만 pintos에서 언급된 0x17A 지점이다.

이렇게 pintos가 수행될 때 인자로 받은 내용을 이미 작성된 커널 이미지를 직접 수정하여 집어넣으면 위의 부팅 과정에서 설명했듯이 init.c의 main 함수에서 `read_command_line()` 함수가 수행될 때 그 인자가 올라가 있는 메모리에 접근하여 인자를 가져오는 것이다. 이 정보는 부트 섹터에 있는데 부트 섹터는 이미 BIOS에 의해 메모리에 올라가 있는 상태이다.

그 다음에는 위에서도 언급했듯이 `parse_options()` 함수가 호출되어 인자로 받은 옵션 정보를 분석하여 내부의 flags를 설정한다. 또 말하자면 대표적인 예는 -q 옵션으로 이는 커널의 모든 작업이 종료되면 전원을 꺼서(power off) bochs가 종료되도록 하는 옵션이다.
이 `parse_options()` 함수는 뒤에서 다시 인자를 분석하게 될 `run_actions()` 함수보다 먼저 수행되므로 Pintos의 flags를 변경하고자 하는 옵션은 당연히 run보다 앞에 나와야 한다.

이제 run 뒤에 나오는 실행 인자가 분석되는 함수인 `run_actions()` 함수를 보자. 이 함수도 위에서 언급했듯이 내부에 이미 실행하려고 하는 대상의 이름과 그 대상으로 수행되어야할 작업이 기술되어있는 함수가 연결되어있는 구조체 action의 배열을 갖는다. 여기서 일치하는 명령이 존재한다면 그를 수행하는 것이고 그렇지 않다면 KERNEL PANIC 메시지를 출력하면서 Pintos는 스스로 kill을 수행할 것이다.

추후에 나오게 될 ls나 cat 등의 명령어도 여기에 있는 것을 볼 수 있다. 즉 이러한 명령들은 커널이 자체적으로 포함하고 있는 내부 명령어로 볼 수 있다.
